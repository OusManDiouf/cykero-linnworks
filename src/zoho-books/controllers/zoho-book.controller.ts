import { Controller, Get, Param } from '@nestjs/common';
import { ZohoBookService } from '../services/zoho-book.service';

@Controller('zoho-books')
export class ZohoBookController {
  constructor(private readonly zohoBooksService: ZohoBookService) {}

  @Get('item/:id')
  async getItem(@Param('id') id: string) {
    return await this.zohoBooksService.getItem(id);
  }
}
