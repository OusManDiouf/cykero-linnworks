import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './schemas/order.schema';
import { LinnworksApiService } from './services/linnworks-api.service';
import { OrderRepositoryService } from './services/order-repository.service';
import { OrderQueueService } from './services/order-queue.service';
import { PollingSchedulerService } from './services/polling-scheduler.service';
import { OrderProcessor, PollingProcessor } from './processors/order.processor';
import { LinnworksController } from './controllers/linnworks.controller';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
    }),
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    // ScheduleModule.forRoot(),
    // BullModule.registerQueue(
    //   { name: 'order-processing' },
    //   { name: 'order-polling' },
    // ),
  ],
  controllers: [LinnworksController],
  providers: [
    LinnworksApiService,
    OrderRepositoryService,
    OrderQueueService,
    PollingSchedulerService,
    OrderProcessor,
    PollingProcessor,
  ],
  exports: [LinnworksApiService, OrderRepositoryService, OrderQueueService],
})
export class LinnworksModule {}
