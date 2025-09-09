import { Injectable, Logger } from '@nestjs/common';
import { ZohoToLinnworksStrategy } from '../strategies/abstract-webhook.strategy';
import {
  CreditNoteWebhookStrategy,
  InventoryAdjustmentWebhookStrategy,
  PurchaseReceiveWebhookStrategy,
  SalesOrderWebhookStrategy,
  VendorCreditWebhookStrategy,
} from '../strategies/webhook-strategies';
import {
  ZohoWebhookPayload,
  ZohoWebhookResource,
} from '../../zoho-books/types/zoho-books-types';
import { LinnworksSkuNotFoundError } from './linnworks-api.service';

@Injectable()
export class ZohoToLinnworksWebhookService {
  private readonly logger = new Logger(ZohoToLinnworksWebhookService.name);
  private readonly strategies: Record<
    ZohoWebhookResource,
    ZohoToLinnworksStrategy
  >;

  constructor(
    salesOrderStrategy: SalesOrderWebhookStrategy,
    purchaseReceiveStrategy: PurchaseReceiveWebhookStrategy,
    inventoryAdjustmentStrategy: InventoryAdjustmentWebhookStrategy,
    vendorCreditStrategy: VendorCreditWebhookStrategy,
    creditNoteStrategy: CreditNoteWebhookStrategy,
  ) {
    this.strategies = {
      salesorder: salesOrderStrategy,
      purchasereceive: purchaseReceiveStrategy,
      inventory_adjustment: inventoryAdjustmentStrategy,
      vendor_credit: vendorCreditStrategy,
      creditnote: creditNoteStrategy,
    };
  }

  async processZohoToLinnworksWebhook(
    payload: ZohoWebhookPayload,
  ): Promise<string> {
    this.logger.log('🛠️  Processing Zoho to Linnworks webhook payload');

    const processingPromises: Promise<void>[] = [];

    // Process each resource type that exists in the payload
    for (const [resourceType, resourceData] of Object.entries(payload)) {
      if (
        resourceData &&
        this.strategies[resourceType as ZohoWebhookResource]
      ) {
        this.logger.debug(`🛠️  Processing ${resourceType} webhook`);

        const strategy = this.strategies[resourceType as ZohoWebhookResource];
        processingPromises.push(strategy.execute(payload));
      }
    }

    if (processingPromises.length === 0) {
      this.logger.warn('No valid resource types found in webhook payload');
      return 'No processing required';
    }

    try {
      // Process all webhooks concurrently
      await Promise.all(processingPromises);

      this.logger.log(
        '✅  All Zoho to Linnworks webhooks processed successfully',
      );
      return 'Zoho to Linnworks webhooks handled successfully';
    } catch (error: any) {
      // Soft-skip when the only problem is "SKU not found"
      if (error instanceof LinnworksSkuNotFoundError) {
        this.logger.debug(
          `ℹ️  Soft-skip Zoho→Linnworks webhook: ${error.message}`,
        );
        return 'Zoho to Linnworks webhooks handled successfully (soft skip)';
      }

      const status = error?.response?.status
        ? `HTTP ${error.response.status}`
        : '';
      const url = error?.config?.url ? ` ${error.config.url}` : '';
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.Message ||
        error?.message ||
        String(error);

      this.logger.error(
        `❌ Failed to process some webhooks: ${status}${url ? ' - ' + url : ''} - ${msg}`,
      );
      throw error;
    }
  }
}
