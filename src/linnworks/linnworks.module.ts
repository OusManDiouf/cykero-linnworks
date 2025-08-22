import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './schemas/order.schema';
import { LinnworksApiService } from './services/linnworks-api.service';
import { OrderRepositoryService } from './services/order-repository.service';
import { OrderQueueService } from './services/order-queue.service';
import { PollingSchedulerService } from './services/polling-scheduler.service';
import { OrderProcessor } from './processors/order.processor';
import { LinnworksController } from './controllers/linnworks.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { PollingProcessor } from './processors/polling.processor';
import { TokenManagerService } from './services/token-manager.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
    }),
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    BullModule.registerQueue(
      { name: 'order-processing' },
      { name: 'order-polling' },
    ),
  ],
  controllers: [LinnworksController],
  providers: [
    TokenManagerService,
    LinnworksApiService,
    OrderRepositoryService,
    OrderQueueService,
    PollingSchedulerService,
    OrderProcessor,
    PollingProcessor,
  ],
  exports: [
    TokenManagerService,
    LinnworksApiService,
    OrderRepositoryService,
    OrderQueueService,
  ],
})
export class LinnworksModule {}
