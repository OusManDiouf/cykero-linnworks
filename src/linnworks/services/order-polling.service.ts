import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderProcessorService } from './order-processor.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class OrderPollingService implements OnModuleInit {
  private readonly logger = new Logger(OrderPollingService.name);
  private isPolling = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly orderProcessor: OrderProcessorService,
  ) {}

  onModuleInit() {
    this.logger.log('✅  Polling service initialized');
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async scheduledPoll(): Promise<void> {
    if (this.isPolling) {
      this.logger.debug('🔂  Poll already in progress, skipping');
      return;
    }

    await this.poll();
  }

  async poll(): Promise<void> {
    this.isPolling = true;

    try {
      const result = await this.orderProcessor.processOpenOrders();

      if (result.savedOrders > 0) {
        this.logger.log(
          `✅  Poll completed: ${result.savedOrders} orders saved (found ${result.newOrders} new)`,
        );
      } else {
        this.logger.debug('🔍️  Poll completed: no orders saved');
      }
    } catch (error) {
      this.logger.error('❌  Poll failed:', error);
    } finally {
      this.isPolling = false;
    }
  }

  getStatus(): { isPolling: boolean } {
    return { isPolling: this.isPolling };
  }
}
