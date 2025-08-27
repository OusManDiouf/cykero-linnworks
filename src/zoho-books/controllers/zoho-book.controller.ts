import { Controller, Get, Param } from '@nestjs/common';
import { ZohoBooksApiService } from '../services/zoho-books-api.service';

@Controller('zoho-books')
export class ZohoBookController {
  constructor(private readonly zohoBooksService: ZohoBooksApiService) {}

  @Get('item/:id')
  async getItem(@Param('id') id: string) {
    return await this.zohoBooksService.getItem(id);
  }
}
