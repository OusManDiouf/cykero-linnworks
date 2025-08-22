import { Controller, Get } from '@nestjs/common';
import { LinnworksApiService } from '../services/linnworks-api.service';
import { OrderRepositoryService } from '../services/order-repository.service';
import { OrderQueueService } from '../services/order-queue.service';
import { PollingSchedulerService } from '../services/polling-scheduler.service';

@Controller('linnworks')
export class LinnworksController {
  constructor(
    private readonly linnworksApi: LinnworksApiService,
    private readonly orderRepository: OrderRepositoryService,
    private readonly queueService: OrderQueueService,
    private readonly pollingScheduler: PollingSchedulerService,
  ) {}

  @Get('status')
  async getStatus() {
    const connectionTest = await this.linnworksApi.testConnection();
    // const getOpenOrders = await this.linnworksApi.getOpenOrders();

    return {
      connected: connectionTest,
      timestamp: new Date().toISOString(),
    };
  }
}
