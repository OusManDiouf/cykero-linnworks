// src/linnworks/services/order-sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OrderRepositoryService } from './order-repository.service';
import { Order } from '../schemas/order.schema';

@Injectable()
export class OrderSyncService {
  private readonly logger = new Logger(OrderSyncService.name);

  constructor(private readonly orderRepository: OrderRepositoryService) {}

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
        this.logger.error(`❌ Failed to sync order ${order._id}:`, error);

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
    this.logger.debug(`Syncing order ${order._id} to Zoho`);

    await this.sleep(500); // Simulate API call
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
