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

    const orderId = '6e9a95a9-9fbd-4d68-8222-40575f6a66cf';

    // await this.linnworksApi.setOrderShippingInfo({
    //   orderId,
    //   info: {
    //     TrackingNumber: '1234567890',
    //   },
    // });

    await this.linnworksApi.processOrder({
      orderId,
      locationId: '00000000-0000-0000-0000-000000000000',
      scanPerformed: true,
    });

    // NOTE: ONCE THE ORDER IS PROCESSED, WE CANT FIND IT ANYMORE USING REGULAR OPEN ORDERS API CALLS
    const getOpenOrdersDetails = await this.linnworksApi.getOpenOrdersDetails({
      OrderIds: [orderId],
    });

    return {
      getOpenOrdersDetails,
      connected: connectionTest,
      timestamp: new Date().toISOString(),
    };
  }
}
