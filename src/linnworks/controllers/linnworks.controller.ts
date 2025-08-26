import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { LinnworksApiService } from '../services/linnworks-api.service';
import { OrderRepositoryService } from '../services/order-repository.service';
import { OrderProcessorService } from '../services/order-processor.service';
import { OrderPollingService } from '../services/order-polling.service';
import { SyncSchedulerService } from '../services/sync-scheduler.service';

@Controller('linnworks')
export class LinnworksController {
  constructor(
    private readonly linnworksApi: LinnworksApiService,
    private readonly orderRepository: OrderRepositoryService,

    private readonly pollingService: OrderPollingService,
    private readonly orderProcessorService: OrderProcessorService,
    private readonly syncScheduler: SyncSchedulerService,
  ) {}

  @Post('poll')
  @HttpCode(HttpStatus.OK)
  async forcePoll() {
    await this.pollingService.poll();
    return { success: true, message: '✅ Poll completed' };
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async forceSync() {
    await this.syncScheduler.sync();
    return { success: true, message: '✅ Sync triggered' };
  }

  @Get('sync/status')
  async getSyncStatus() {
    const pendingCount =
      await this.orderRepository.findOrdersByStatus('pending');
    const failedCount = await this.orderRepository.findOrdersByStatus('failed');

    return {
      pending: pendingCount.length,
      failed: failedCount.length,
    };
  }

  @Get('status')
  async getStatus() {
    const connectionTest = await this.linnworksApi.testConnection();

    const orderId = '4a9090e0-b011-4a94-8f2a-fcf991a3f1f7';

    // await this.linnworksApi.setOrderShippingInfo({
    //   orderId,
    //   info: {
    //     TrackingNumber: '1234567890',
    //   },
    // });

    // await this.linnworksApi.processOrder({
    //   orderId,
    //   locationId: '00000000-0000-0000-0000-000000000000',
    //   scanPerformed: true,
    // });

    // // NOTE: ONCE THE ORDER IS PROCESSED, WE CANT FIND IT ANYMORE USING REGULAR OPEN ORDERS API CALLS
    // const getOpenOrdersDetails = await this.linnworksApi.getOpenOrdersDetails({
    //   OrderIds: [orderId],
    // });
    // const order = getOpenOrdersDetails.at(0);
    // if (!order) {
    //   throw new Error('Order not found');
    // }
    //
    // const orderFromDb = await this.orderRepository.findById(orderId);
    // console.log('orderFromDb', orderFromDb, orderFromDb?.GeneralInfo?.Status);

    // try {
    //   await this.orderRepository.upsertFromEnvelope({
    //     order,
    //     connected: order?.connected,
    //     timestamp: order?.timestamp,
    //   });
    // } catch (error) {
    //   console.log(error);
    // }

    // const yesterday = new Date();
    // yesterday.setDate(yesterday.getDate() - 1);
    // const getRecentOpenOrders = await this.linnworksApi.getRecentOpenOrders(
    //   yesterday,
    //   new Set<string>(),
    // );

    // ==============================================
    // const getAllOpenOrderIds = await this.linnworksApi.getAllOpenOrderIds();
    // const getOpenOrdersDetails =
    //   await this.linnworksApi.getOpenOrderDetailsByIds({
    //     OrderIds: [...getAllOpenOrderIds],
    //   });
    // const orderFromDb = await this.orderRepository.getSavedOrderIds();

    const processOpenOrders =
      await this.orderProcessorService.processOpenOrders();
    return {
      processOpenOrders,
      connected: connectionTest,
      timestamp: new Date().toISOString(),
    };
  }
}
