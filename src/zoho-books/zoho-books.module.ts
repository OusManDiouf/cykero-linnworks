import { Module } from '@nestjs/common';
import { ZohoBookService } from './services/zoho-book.service';
import { ZohoAuthService } from './services/zoho-auth.service';
import { RedisService } from './services/redis.service';
import { ZohoBookController } from './controllers/zoho-book.controller';

@Module({
  imports: [],
  providers: [ZohoBookService, ZohoAuthService, RedisService],
  exports: [ZohoBookService, ZohoAuthService, RedisService],
  controllers: [ZohoBookController],
})
export class ZohoBooksModule {}
