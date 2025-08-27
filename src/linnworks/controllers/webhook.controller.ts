// src/integrations/zoho-linnworks/controllers/webhook.controller.ts

import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Post,
} from '@nestjs/common';
import { ZohoToLinnworksWebhookService } from '../services/webhook.service';
import type { ZohoWebhookPayload } from '../../zoho-books/types/zoho-books-types';

@Controller('webhooks/zoho-linnworks')
export class ZohoToLinnworksWebhookController {
  private readonly logger = new Logger(ZohoToLinnworksWebhookController.name);

  constructor(private readonly webhookService: ZohoToLinnworksWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleZohoWebhook(@Body() payload: ZohoWebhookPayload) {
    try {
      this.logger.log('Received Zoho to Linnworks webhook');
      this.logger.debug('Webhook payload keys:', Object.keys(payload));

      // Basic payload validation
      if (!payload || typeof payload !== 'object') {
        throw new BadRequestException('Invalid webhook payload');
      }

      const result =
        await this.webhookService.processZohoToLinnworksWebhook(payload);

      return {
        success: true,
        message: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error processing Zoho to Linnworks webhook:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException({
        message: 'Failed to process webhook',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testWebhook() {
    this.logger.log('Test endpoint called');

    // Sample test payload
    const testPayload: ZohoWebhookPayload = {
      inventory_adjustment: {
        line_items: [
          {
            item_id: '347732000016381289',
            sku: 'SM/TE/IPH/15+/512GB/GREE/C/ANY/R/1',
          },
        ],
      },
      salesorder: undefined,
      purchasereceive: undefined,
      vendor_credit: undefined,
      creditnote: undefined,
    };

    try {
      const result =
        await this.webhookService.processZohoToLinnworksWebhook(testPayload);

      return {
        success: true,
        message: `Test completed: ${result}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Test webhook failed:', error);
      throw new InternalServerErrorException({
        message: 'Test webhook failed',
        error: error.message,
      });
    }
  }
}
