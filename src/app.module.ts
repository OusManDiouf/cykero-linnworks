import { Logger, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ZohoBooksModule } from '@cykerosoftware/zoho-books';
import { ConfigModule, ConfigService } from '@nestjs/config';
import databaseConfig from './config/database.config';
import linnworksConfig from './config/linnworks.config';
import { ScheduleModule } from '@nestjs/schedule';
import { LinnworksModule } from './linnworks/linnworks.module';
import { MongooseModule } from '@nestjs/mongoose';

const logger = new Logger('AppModule');
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, linnworksConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('database.mongodb.uri'),
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        ...configService.get('database.mongodb.options'),
        onConnectionCreate: (connection) => {
          connection.on('connected', () =>
            logger.log('✅  MongoDB connection established successfully'),
          );
          return connection;
        },
      }),
      inject: [ConfigService],
    }),
    ZohoBooksModule.forRoot({
      baseUrl: 'https://books.zoho.com/api/v3',
      authToken: 'your-token',
      organizationId: 'your-org-id',
    }),
    ScheduleModule.forRoot(),
    LinnworksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
