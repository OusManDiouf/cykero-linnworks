import { Logger, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import databaseConfig from './config/database.config';
import linnworksConfig from './config/linnworks.config';
import { ScheduleModule } from '@nestjs/schedule';
import { LinnworksModule } from './linnworks/linnworks.module';
import { MongooseModule } from '@nestjs/mongoose';
import { AppRedisModule } from './redis/redis.module';
import { ZohoBooksModule } from './zoho-books/zoho-books.module';

const logger = new Logger('AppModule');
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, linnworksConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    AppRedisModule,
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
    ScheduleModule.forRoot(),
    ScheduleModule.forRoot(),
    LinnworksModule,
    ZohoBooksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
