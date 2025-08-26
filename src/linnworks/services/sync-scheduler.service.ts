import { Injectable, Logger } from '@nestjs/common';
import { OrderSyncService } from './order-sync.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SyncSchedulerService {
  private readonly logger = new Logger(SyncSchedulerService.name);
  private isSyncing = false;

  constructor(private readonly orderSync: OrderSyncService) {}

  @Cron(CronExpression.EVERY_MINUTE) // Every minute
  async scheduledSync(): Promise<void> {
    if (this.isSyncing) {
      this.logger.debug('🔃  Sync already in progress, skipping');
      return;
    }

    await this.sync();
  }

  async sync(): Promise<void> {
    this.isSyncing = true;

    try {
      const result = await this.orderSync.processPendingSync();

      if (result.syncedOrders > 0) {
        this.logger.log(`✅  Synced ${result.syncedOrders} orders to Zoho`);
      }
    } catch (error) {
      this.logger.error('❌  Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }
}
