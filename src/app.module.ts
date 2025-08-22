import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ZohoBooksModule } from '@cykerosoftware/zoho-books';

@Module({
  imports: [
    ZohoBooksModule.forRoot({
      baseUrl: 'https://books.zoho.com/api/v3',
      authToken: 'your-token',
      organizationId: 'your-org-id',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
