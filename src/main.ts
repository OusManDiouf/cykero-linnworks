import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LogLevel } from '@nestjs/common';
import { json, urlencoded } from 'express';

function resolveLogger(): false | LogLevel[] {
  const level = (process.env.LOG_LEVEL || 'log').toLowerCase();

  // Accept common aliases
  switch (level) {
    case 'silent':
    case 'off':
    case 'none':
      return false; // disables all Nest logs
    case 'error':
      return ['error'];
    case 'warn':
      return ['warn', 'error'];
    case 'log':
    case 'info':
      return ['log', 'warn', 'error'];
    case 'debug':
      return ['debug', 'log', 'warn', 'error'];
    case 'verbose':
      return ['verbose', 'debug', 'log', 'warn', 'error'];
    default:
      // Fallback to safe defaults
      return ['log', 'warn', 'error'];
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: resolveLogger(),
  });

  // Increase request body limits to handle large Zoho payloads (e.g., 25 MB)
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ limit: '25mb', extended: true }));

  await app.listen(process.env.PORT ?? 5000, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}
void bootstrap();
