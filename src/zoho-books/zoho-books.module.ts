import { Module } from '@nestjs/common';
import { ZohoBooksApiService } from './services/zoho-books-api.service';
import { ZohoAuthService } from './services/zoho-auth.service';
import { RedisService } from './services/redis.service';
import { ZohoBookController } from './controllers/zoho-book.controller';
import { HttpModule } from '@nestjs/axios';
import { OrderTransformer } from './transformers/order.transformer';
import { ZohoBooksCustomerService } from './services/zoho-books-customer.service';

@Module({
  imports: [HttpModule],
  providers: [
    ZohoBooksApiService,
    ZohoAuthService,
    RedisService,
    OrderTransformer,
    ZohoBooksCustomerService,
  ],
  exports: [
    ZohoBooksApiService,
    ZohoAuthService,
    RedisService,
    OrderTransformer,
    ZohoBooksCustomerService,
  ],
  controllers: [ZohoBookController],
})
export class ZohoBooksModule {}
