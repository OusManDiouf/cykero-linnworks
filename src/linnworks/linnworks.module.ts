import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './schemas/order.schema';
import { LinnworksApiService } from './services/linnworks-api.service';
import { OrderRepositoryService } from './services/order-repository.service';
import { LinnworksController } from './controllers/linnworks.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { TokenManagerService } from './services/token-manager.service';
import { OrderProcessorService } from './services/order-processor.service';
import { OrderPollingService } from './services/order-polling.service';
import { SyncSchedulerService } from './services/sync-scheduler.service';
import { OrderSyncService } from './services/order-sync.service';
import { ZohoBooksModule } from '../zoho-books/zoho-books.module';
import { StockUpdateWebhookController } from './controllers/webhook-stock-update.controller';
import { ZohoToLinnworksWebhookService } from './services/webhook.service';
import {
  CreditNoteWebhookStrategy,
  InventoryAdjustmentWebhookStrategy,
  PurchaseReceiveWebhookStrategy,
  SalesOrderWebhookStrategy,
  VendorCreditWebhookStrategy,
} from './strategies/webhook-strategies';
import { ShipmentWebhookController } from './controllers/webhook-shipment.controller';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
    }),
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    ZohoBooksModule,
  ],
  controllers: [
    LinnworksController,
    StockUpdateWebhookController,
    ShipmentWebhookController,
  ],
  providers: [
    TokenManagerService,
    LinnworksApiService,
    OrderPollingService,
    OrderProcessorService,
    OrderRepositoryService,
    // sync from linn --> zohobooks
    OrderSyncService,
    SyncSchedulerService,
    ZohoToLinnworksWebhookService,
    // Strategies
    SalesOrderWebhookStrategy,
    PurchaseReceiveWebhookStrategy,
    InventoryAdjustmentWebhookStrategy,
    VendorCreditWebhookStrategy,
    CreditNoteWebhookStrategy,
  ],
  exports: [
    TokenManagerService,
    LinnworksApiService,
    OrderRepositoryService,
    OrderProcessorService,
  ],
})
export class LinnworksModule {}
