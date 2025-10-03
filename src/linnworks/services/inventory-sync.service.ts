import { Injectable, Logger } from '@nestjs/common';
import Bottleneck from 'bottleneck';
import { ConfigService } from '@nestjs/config';
import { LinnworksApiService } from './linnworks-api.service';
import { ZohoBooksApiService } from '../../zoho-books/services/zoho-books-api.service';
import {
  ZohoItem,
  ZohoLocation,
} from '../../zoho-books/types/zoho-books-types';

type StockUpdateItem = {
  itemSKU: string;
  itemStocksCount: number;
  locationName: string;
};

// Narrow type to what we need from GetStockItemsFull items
export interface LwStockItemFull {
  Suppliers: unknown[];
  StockLevels: unknown[];
  ItemChannelDescriptions: unknown[];
  ItemExtendedProperties: unknown[];
  ItemChannelTitles: unknown[];
  ItemChannelPrices: unknown[];
  Images: unknown[];
  ItemNumber: string; // Use as SKU
  ItemTitle: string;
  BarcodeNumber?: string | null;
  MetaData?: string;
  IsVariationParent: boolean;
  isBatchedStockType: boolean;
  PurchasePrice: number;
  TaxRate: number;
  PostalServiceId: string;
  CategoryId: string;
  CategoryName: string;
  PackageGroupId: string;
  Height: number;
  Width: number;
  Depth: number;
  Weight: number;
  CreationDate: string;
  InventoryTrackingType: number;
  BatchNumberScanRequired: boolean;
  SerialNumberScanRequired: boolean;
  StockItemId: string; // UUID
  StockItemIntId: number;
}

interface GetStockItemsFullResponse {
  items: LwStockItemFull[];
  totalItems: number;
  pageNumber: number;
  entriesPerPage: number;
}

@Injectable()
export class InventorySyncService {
  private readonly logger = new Logger(InventorySyncService.name);

  // Zoho Location IDs to keep
  private readonly GMBH_WAREHOUSE_ID = '347732000000070863';
  private readonly SAS_WAREHOUSE_ID = '347732000000070865';

  // Linnworks location names that must match your LW locations
  private readonly GMBH_LOCATION_NAME = 'Cykero GmbH (Warehouse)';
  private readonly SAS_LOCATION_NAME = 'Cykero ML (Warehouse)';

  private readonly limiter: Bottleneck;
  private isRunning = false;

  constructor(
    private readonly config: ConfigService,
    private readonly linnworks: LinnworksApiService,
    private readonly zohoBooksApiService: ZohoBooksApiService,
  ) {
    // Configure limiter (defaults: 80 req/min, max 2 concurrent)
    const rpm = Number(this.config.get('ZOHO_RATE_LIMIT_RPM')) || 80;
    const maxConcurrent =
      Number(this.config.get('ZOHO_RATE_LIMIT_CONCURRENCY')) || 2;

    this.limiter = new Bottleneck({
      reservoir: rpm,
      reservoirRefreshAmount: rpm,
      reservoirRefreshInterval: 60_000,
      maxConcurrent,
      minTime: Math.ceil((60_000 / Math.max(1, rpm)) * (1 / maxConcurrent)),
    });
  }

  startManualSync(): { started: boolean; message: string } {
    if (this.isRunning) {
      return { started: false, message: 'A sync is already in progress' };
    }
    this.isRunning = true;
    void this.run().finally(() => (this.isRunning = false));
    return { started: true, message: 'Manual inventory sync started' };
  }

  private async run(): Promise<void> {
    const lwPageSize =
      Number(this.config.get('INVENTORY_SYNC_BATCH_SIZE')) || 200;
    const lwUpdateBatch =
      Number(this.config.get('LINNWORKS_UPDATE_BATCH_SIZE')) || 50;

    let totalSkus = 0;
    let totalZohoBatches = 0;
    let totalUpdatedLines = 0;

    try {
      for await (const pageItems of this.fetchLwInventory(lwPageSize)) {
        if (!pageItems.length) continue;
        totalSkus += pageItems.length;

        // Extract Zoho item_ids from Linnworks items (BarcodeNumber)
        const itemIds: string[] = pageItems
          .map((i) => {
            const id = (i.BarcodeNumber ?? '').toString().trim();
            return id.length > 0 ? id : '';
          })
          .filter((id) => id.length > 0);

        if (!itemIds.length) continue;

        // Fetch Zoho item details in one call (service internally batches by 50 and runs sequentially)
        let details: ZohoItem[] = [];
        try {
          details = await this.limiter.schedule(() =>
            this.zohoBooksApiService.getAllItemDetails(itemIds),
          );
          totalZohoBatches++;
        } catch (e) {
          const err = e as Error;
          this.logger.error(
            `❌ Zoho bulk details failed (${itemIds.length} ids): ${err.message}`,
          );
          continue;
        }

        // Build updates from the two locations of interest
        const updates: StockUpdateItem[] = [];
        for (const d of details) {
          const sku = d?.sku?.trim();
          if (!sku) continue;

          const locations: ZohoLocation[] = Array.isArray(d.locations)
            ? d.locations
            : [];

          const gmbh = locations.find(
            (w) => w.location_id === this.GMBH_WAREHOUSE_ID,
          );
          const sas = locations.find(
            (w) => w.location_id === this.SAS_WAREHOUSE_ID,
          );

          if (gmbh) {
            updates.push({
              itemSKU: sku,
              itemStocksCount:
                Math.max(
                  0,
                  Number(gmbh.location_actual_available_for_sale_stock ?? 0),
                ) || 0,
              locationName: this.GMBH_LOCATION_NAME,
            });
          }
          if (sas) {
            updates.push({
              itemSKU: sku,
              itemStocksCount:
                Math.max(
                  0,
                  Number(sas.location_actual_available_for_sale_stock ?? 0),
                ) || 0,
              locationName: this.SAS_LOCATION_NAME,
            });
          }
        }

        if (!updates.length) continue;

        // Push updates to Linnworks in chunks
        const updateChunks = this.chunk(updates, lwUpdateBatch);
        for (const up of updateChunks) {
          try {
            await this.linnworks.updateStockLevels(up);
            totalUpdatedLines += up.length;
          } catch (e) {
            const err = e as Error;
            this.logger.error(
              `❌ Linnworks update error for ${up.length} lines: ${err.message}`,
            );
          }
        }
      }
      this.logger.log(
        `✅ Stock sync completed | LW SKUs processed=${totalSkus} | Zoho bulk batches=${totalZohoBatches} | LW updated lines=${totalUpdatedLines}`,
      );
    } catch (e) {
      const err = e as Error;
      this.logger.error(`❌ Inventory sync failed: ${err.message}`, err.stack);
    }
  }

  // Generator over GetStockItemsFull pages (fully typed)
  private async *fetchLwInventory(
    pageSize: number,
  ): AsyncGenerator<LwStockItemFull[]> {
    let page = 1;

    while (true) {
      const resp = (await this.linnworks.getStockItemsFull({
        pageNumber: page,
        entriesPerPage: pageSize,
      })) as GetStockItemsFullResponse;

      const items = Array.isArray(resp?.items) ? resp.items : [];
      if (!items.length) break;

      const mapped: LwStockItemFull[] = items.map((it) => ({
        Suppliers: it.Suppliers ?? [],
        StockLevels: it.StockLevels ?? [],
        ItemChannelDescriptions: it.ItemChannelDescriptions ?? [],
        ItemExtendedProperties: it.ItemExtendedProperties ?? [],
        ItemChannelTitles: it.ItemChannelTitles ?? [],
        ItemChannelPrices: it.ItemChannelPrices ?? [],
        Images: it.Images ?? [],
        ItemNumber: String(it.ItemNumber || '').trim(),
        ItemTitle: String(it.ItemTitle || ''),
        BarcodeNumber: String(it.BarcodeNumber || '').trim(),
        MetaData: it.MetaData ?? '',
        IsVariationParent: !!it.IsVariationParent,
        isBatchedStockType: !!it.isBatchedStockType,
        PurchasePrice: Number(it.PurchasePrice ?? 0),
        TaxRate: Number(it.TaxRate ?? 0),
        PostalServiceId: String(it.PostalServiceId || ''),
        CategoryId: String(it.CategoryId || ''),
        CategoryName: String(it.CategoryName || ''),
        PackageGroupId: String(it.PackageGroupId || ''),
        Height: Number(it.Height ?? 0),
        Width: Number(it.Width ?? 0),
        Depth: Number(it.Depth ?? 0),
        Weight: Number(it.Weight ?? 0),
        CreationDate: String(it.CreationDate || ''),
        InventoryTrackingType: Number(it.InventoryTrackingType ?? 0),
        BatchNumberScanRequired: !!it.BatchNumberScanRequired,
        SerialNumberScanRequired: !!it.SerialNumberScanRequired,
        StockItemId: String(it.StockItemId || ''),
        StockItemIntId: Number(it.StockItemIntId ?? 0),
      }));

      yield mapped;

      page++;
      await this.sleep(100);
    }
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
