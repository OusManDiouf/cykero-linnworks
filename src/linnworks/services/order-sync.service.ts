// src/linnworks/services/order-sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OrderRepositoryService } from './order-repository.service';
import { Order } from '../schemas/order.schema';
import { ZohoBooksCustomerService } from '../../zoho-books/services/zoho-books-customer.service';
import { OrderDto } from '../dto/order.dto';
import { OrderTransformer } from '../../zoho-books/transformers/order.transformer';
import { ZohoBooksApiService } from '../../zoho-books/services/zoho-books-api.service';

@Injectable()
export class OrderSyncService {
  private readonly logger = new Logger(OrderSyncService.name);
  private readonly GMBH_WAREHOUSE_ID = '347732000000070863';
  private readonly SAS_WAREHOUSE_ID = '347732000000070865';

  constructor(
    private readonly orderRepository: OrderRepositoryService,
    private readonly zohoCustomer: ZohoBooksCustomerService,
    private readonly booksApi: ZohoBooksApiService,
    private readonly orderTransformer: OrderTransformer,
  ) {}

  /**
   * Processes pending orders that need synchronization.
   * Retrieves orders with a "pending" status, attempts to synchronize each order
   * to an external system, and updates their statuses based on the success or failure
   * of the synchronization process. Ensures a controlled pace by including a delay
   * between processing individual orders.
   *
   * @return {Promise<{pendingOrders: number, syncedOrders: number, failedOrders: number}>}
   *         A promise resolving to an object containing the count of pending, successfully synced,
   *         and failed orders.
   */
  async processPendingSync(): Promise<{
    pendingOrders: number;
    syncedOrders: number;
    failedOrders: number;
  }> {
    // Step 1: Get orders that need syncing
    const pendingOrders =
      await this.orderRepository.findOrdersByStatus('pending');

    if (pendingOrders.length === 0) {
      return { pendingOrders: 0, syncedOrders: 0, failedOrders: 0 };
    }

    this.logger.debug(`🔍️  Found ${pendingOrders.length} orders to sync`);

    let synced = 0;
    let failed = 0;

    // Step 2: Process each order (controlled pace)
    for (const order of pendingOrders) {
      try {
        await this.syncOrderToZoho(order);

        await this.orderRepository.updateSyncStatus(order._id, 'synced');
        synced++;

        // Small delay for controlled pace
        await this.sleep(1000); // 1 second between syncs
      } catch (e: unknown) {
        const error = e as Error;
        this.logger.error(
          `❌ Failed to sync order ${order._id}:`,
          error.message,
        );

        await this.orderRepository.updateSyncStatus(
          order._id,
          'failed',
          error.message,
        );
        failed++;
      }
    }

    this.logger.log(`✅  Sync complete: ${synced} synced, ${failed} failed`);

    return {
      pendingOrders: pendingOrders.length,
      syncedOrders: synced,
      failedOrders: failed,
    };
  }

  private async syncOrderToZoho(order: Order): Promise<void> {
    // TODO: Implement Zoho sync logic here
    this.logger.debug(`🛠️  Syncing order ${order._id} to Zoho`);

    // 1) Ensure customer exists (no side-effects in transformer)
    const ensure = await this.zohoCustomer.ensureCustomerForOrder(
      order as unknown as OrderDto,
    );
    if (!ensure.success || !ensure.customerId) {
      throw new Error(ensure.errorMessage || 'Failed to ensure Zoho customer');
    }
    const customerId = ensure.customerId;
    if (!customerId) {
      throw new Error('❌  Failed to get Zoho customer ID');
    }

    // 2) payload via transformer (synchronous, no I/O)
    const basePayload = this.orderTransformer.transformToZohoSalesOrder(
      order as unknown as OrderDto,
      customerId,
    );

    // 3) Resolve each item_id by SKU and build final line_items
    const items = Array.isArray(order.Items) ? order.Items : [];
    const resolvedLineItems: {
      item_id: string;
      quantity: number;
      rate: number;
      bcy_rate: number;
      warehouse_id: string;
      tax_id: string;
    }[] = [];

    for (const item of items) {
      const sku = this.extractSku(item);
      const quantity = this.extractQuantity(item);
      const rate = this.extractRate(item);

      if (!sku) {
        throw new Error('Missing SKU for an order item');
      }

      // Direct call to Zoho Books (no local cache)
      const zohoItem = await this.booksApi.getItemBySku(sku);

      // Small delay to avoid hammering Zoho API between dependent calls
      await this.sleep(200);

      // Fetch full details to obtain tax_id (and other fields if needed)
      const zohoItemDetail = await this.booksApi.findItemDetailsByID(
        zohoItem.item_id,
      );

      resolvedLineItems.push({
        item_id: zohoItem.item_id,
        quantity,
        rate,
        bcy_rate: rate,
        warehouse_id: this.GMBH_WAREHOUSE_ID,
        tax_id: zohoItemDetail?.tax_id,
      });
    }

    const salesOrderPayload = {
      ...basePayload,
      line_items: resolvedLineItems,
    };

    const result = await this.booksApi.createSalesOrder(salesOrderPayload);
    // Small delay to avoid hammering Zoho API between dependent calls
    if (result.salesorder?.salesorder_id) {
      // Persist mapping so webhooks can resolve the order
      await this.orderRepository.setZohoSalesOrderId(
        order._id,
        result.salesorder.salesorder_id,
      );

      await this.booksApi.markSaleOrderAsApproved(
        result.salesorder.salesorder_id,
      );

      await this.sleep(500);

      await this.booksApi.markSaleOrderAsConfirmed(
        result.salesorder.salesorder_id,
      );
    }
  }

  private extractSku(item: Record<string, unknown>): string | undefined {
    return (
      (item['SKU'] as string) ||
      (item['sku'] as string) ||
      (item['ItemNumber'] as string) ||
      (item['ChannelSKU'] as string) ||
      undefined
    );
  }

  private extractQuantity(item: Record<string, unknown>): number {
    const q = (item['Quantity'] as number) ?? (item['quantity'] as number) ?? 1;
    return typeof q === 'number' ? q : parseInt(String(q)) || 1;
  }

  private extractRate(item: Record<string, unknown>): number {
    const r =
      (item['PricePerUnit'] as number) ??
      (item['UnitPrice'] as number) ??
      (item['Rate'] as number) ??
      (item['rate'] as number) ??
      0;
    return typeof r === 'number' ? r : parseFloat(String(r)) || 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
