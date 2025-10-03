// src/linnworks/controllers/zoho-inventory-shipment.controller.ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Post,
} from '@nestjs/common';
import { OrderRepositoryService } from '../services/order-repository.service';
import { LinnworksApiService } from '../services/linnworks-api.service';
import { LocationService } from '../services/location.service';

interface ZohoSalesOrderLineItem {
  sku: string;
  quantity: number;
}

interface ZohoPkg {
  package_id: string;
  shipment_id: string;
  shipment_order: {
    shipment_date: string;
    shipment_date_formatted: string;
    tracking_number: string;
  };
}

interface ZohoSalesOrderWithPkgPayload {
  salesorder: {
    salesorder_id: string;
    line_items: ZohoSalesOrderLineItem[];
    packages: ZohoPkg[];
  };
}

@Controller('webhooks/zoho-linnworks')
export class ShipmentWebhookController {
  private readonly logger = new Logger(ShipmentWebhookController.name);

  constructor(
    private readonly orderRepo: OrderRepositoryService,
    private readonly linnworksApi: LinnworksApiService,
    private readonly locationService: LocationService,
  ) {}

  /**
   * Shipment webhook endpoint:
   * - Resolve our order via previously stored zohoSalesOrderId
   * - Push tracking number to Linnworks (/Orders/SetOrderShippingInfo)
   */
  @Post('shipment')
  @HttpCode(HttpStatus.OK)
  async handleZohoShipment(
    @Body() payload: ZohoSalesOrderWithPkgPayload,
  ): Promise<{ message: string }> {
    if (!payload?.salesorder.salesorder_id) {
      return { message: 'Missing salesorder_id' };
    }

    const order = await this.orderRepo.findByZohoSalesOrderId(
      payload.salesorder.salesorder_id,
    );

    if (!order) {
      this.logger.warn(
        `ℹ️  Skipped (Unknown to the system): salesorder_id=${payload.salesorder.salesorder_id}`,
      );
      // 204 like original behavior for "not processable"
      return { message: 'Salesorder not found' };
    }

    this.logger.log(
      `🛠️ ZOHO WEBHOOK → updating Linnworks shipment for order ${order._id}`,
    );

    const foundPkg = payload.salesorder.packages?.[0];
    const tracking = foundPkg?.shipment_order?.tracking_number?.trim();

    if (!tracking) {
      this.logger.warn(
        `⚠️ No tracking number provided for salesorder_id=${payload.salesorder.salesorder_id}`,
      );
      throw new Error('No tracking number provided');
    }

    // 1) Set tracking number on Linnworks
    await this.linnworksApi.setOrderShippingInfo({
      orderId: order._id,
      info: { TrackingNumber: tracking },
    });

    // 2) Mark order as processed in Linnworks (only after tracking is set)
    const locationId = this.locationService.getOrderLinnworksLocationId(order);

    try {
      const result = await this.linnworksApi.processOrder({
        orderId: order._id,
        locationId,
        scanPerformed: true,
      });

      // reflect locally
      if (result?.Processed) {
        await this.orderRepo.markOrderAsProcessed(order._id);
      }
      this.logger.log(
        `✅ Order ${order._id} processed in Linnworks (Processed=${result?.Processed})`,
      );
    } catch (err: unknown) {
      // If processing fails, we still succeeded setting tracking; surface a clear error
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to process order ${order._id} after setting tracking: ${message}`,
      );
      throw new InternalServerErrorException({
        message: '⚠️  Tracking set, but order processing failed',
        error: message,
        timestamp: new Date().toISOString(),
      });
    }

    return { message: 'Order Shipped' };
  }
}
