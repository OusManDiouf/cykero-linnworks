import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  mongodb: {
    uri:
      process.env.MONGODB_URI ||
      'mongodb://localhost:27017/linnworks_integration',
    options: {},
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT as string, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
}));
