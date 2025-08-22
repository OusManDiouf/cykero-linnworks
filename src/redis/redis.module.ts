import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';

@Global()
@Module({
  imports: [
    RedisModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url:
          configService.get<string>('database.redis.url') ||
          `redis://${configService.get<string>('database.redis.host')}:${configService.get<number>('database.redis.port')}`,
        options: {
          password: configService.get<string>('database.redis.password'),
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxRetriesPerRequest: null,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [RedisModule],
})
export class AppRedisModule {}
