import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly redisClient: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redisClient = new Redis({
      host: this.configService.get('REDIS_HOST') || 'localhost',
      port: parseInt(this.configService.get('REDIS_PORT') || '6379', 10),
      db: this.configService.get('REDIS_DB') || 12,
    });
  }

  ping() {
    return this.redisClient.ping();
  }

  async set(
    key: string,
    value: string,
    expirationInSeconds: number = 3600 - 10,
  ) {
    await this.redisClient.set(key, value, 'EX', expirationInSeconds);
  }

  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }
}
