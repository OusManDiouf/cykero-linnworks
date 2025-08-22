import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import type { ZohoBooksConfig } from '@cykerosoftware/zoho-books';
import { ZohoBooksService } from '@cykerosoftware/zoho-books';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly zohoBooksService: ZohoBooksService,
  ) {}

  @Get()
  getHello(): ZohoBooksConfig {
    const conf: ZohoBooksConfig = this.zohoBooksService.getConfig();
    console.log(conf);
    return conf;
  }
}
