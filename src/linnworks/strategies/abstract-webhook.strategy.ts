import { Injectable, Logger } from '@nestjs/common';
import type { ZohoWebhookResource } from '../../zoho-books/types/zoho-books-types';
import { ZohoWebhookPayload } from '../../zoho-books/types/zoho-books-types';
import { ZohoBooksApiService } from '../../zoho-books/services/zoho-books-api.service';
import { LinnworksApiService } from '../services/linnworks-api.service';

export interface ZohoToLinnworksStrategy {
  execute(payload: ZohoWebhookPayload): Promise<void>;
}

@Injectable()
export abstract class AbstractWebhookStrategy
  implements ZohoToLinnworksStrategy
{
  private readonly logger = new Logger(AbstractWebhookStrategy.name);
  private readonly GMBH_WAREHOUSE_ID = '347732000000070863';
  private readonly SAS_WAREHOUSE_ID = '347732000000070865';

  protected readonly resourceType: ZohoWebhookResource;
  protected readonly targetWarehouses = [
    this.GMBH_WAREHOUSE_ID,
    this.SAS_WAREHOUSE_ID,
  ];

  constructor(
    resourceType: ZohoWebhookResource,
    protected readonly zohoService: ZohoBooksApiService,
    protected readonly linnworksApiService: LinnworksApiService,
  ) {
    this.resourceType = resourceType;
  }

  public async execute(payload: ZohoWebhookPayload): Promise<void> {
    const resourceData = payload[this.resourceType];

    if (!resourceData?.line_items?.length) {
      this.logger.debug(`No line items found for ${this.resourceType}`);
      return;
    }

    const { line_items } = resourceData;

    this.logger.log(
      `>>>>>> ${this.resourceType.toUpperCase()} WEBHOOK STRATEGY EXECUTED - Processing ${line_items.length} items`,
    );

    let stockUpdateItems: {
      itemSKU: string;
      itemStocksCount: number;
      warehouseName: string;
    }[] = [];

    try {
      // Get item IDs from line items
      const itemIds = this.zohoService.getItemIds(line_items);

      // Fetch detailed item information from Zoho
      const itemDetails = await this.zohoService.getAllItemDetails(itemIds);

      // Calculate stock levels by warehouse
      stockUpdateItems = this.zohoService.getStocksItemByWarehouse(
        itemDetails,
        this.targetWarehouses,
      );

      this.logger.debug(
        `Found ${stockUpdateItems.length} items to update in Linnworks`,
      );
    } catch (error) {
      this.logger.error(
        `**** ERROR DURING ${this.resourceType.toUpperCase()} UPDATE - REASON: ${
          (error as Error).message
        }`,
      );
      throw error;
    }

    // Update stock levels in Linnworks for each item
    const successfulUpdates: string[] = [];
    const failedUpdates: string[] = [];

    for (const item of stockUpdateItems) {
      try {
        await this.linnworksApiService.updateSingleItemStock(
          item.itemSKU,
          item.itemStocksCount,
          item.warehouseName,
        );

        successfulUpdates.push(item.itemSKU);
        this.logger.debug(
          `✅ Updated stock for SKU: ${item.itemSKU} to level: ${item.itemStocksCount}`,
        );
      } catch (error) {
        failedUpdates.push(item.itemSKU);
        this.logger.warn(`⚠️  ${(error as Error).message}`);
      }
    }

    this.logger.log(
      `${this.resourceType.toUpperCase()} processing complete: ${successfulUpdates.length} successful, ${failedUpdates.length} failed`,
    );

    if (failedUpdates.length > 0) {
      this.logger.warn(`Failed SKUs: ${failedUpdates.join(', ')}`);
    }
  }
}
