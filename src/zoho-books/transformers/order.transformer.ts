// src/zoho-books/transformers/order.transformer.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  ZohoBooksAddress,
  ZohoBooksSalesOrderRequest,
  ZohoLineItem,
} from '../types/zoho-books-types';
import { OrderDto } from '../../linnworks/dto/order.dto';

@Injectable()
export class OrderTransformer {
  private readonly logger = new Logger(OrderTransformer.name);

  /**
   * Transform Linnworks order to Zoho Books sales order format
   */
  transformToZohoSalesOrder(
    order: OrderDto,
    customerId: string, // Optional override for customer mapping
  ): ZohoBooksSalesOrderRequest {
    this.logger.debug(`Transforming order ${order._id} to Zoho format`);

    const zohoOrder: ZohoBooksSalesOrderRequest = {
      // REQUIRED FIELDS
      customer_id: customerId,
      line_items: this.transformLineItems(order.Items),

      // OPTIONAL FIELDS - only include if we have meaningful data
      date: this.formatDate(order.GeneralInfo?.ReceivedDate),
      currency_code: this.mapCurrency(order.TotalsInfo?.Currency),
      reference_number: this.buildReferenceNumber(order),
      // billing_address: this.transformAddress(
      //   order.CustomerInfo?.BillingAddress,
      // ),
      // shipping_address: this.transformAddress(order.CustomerInfo?.Address),
      notes: this.buildOrderNotes(order),
      is_inclusive_tax: true,
    };

    // Add shipping charges if present
    const shippingCharge = this.extractShippingCost(order);
    if (shippingCharge > 0) {
      zohoOrder.shipping_charge = shippingCharge;
      zohoOrder.bcy_shipping_charge = shippingCharge;
    }

    return zohoOrder;
  }

  /**
   * Transform Linnworks items to Zoho line items
   */
  private transformLineItems(items: Record<string, unknown>[]): ZohoLineItem[] {
    if (!Array.isArray(items) || items.length === 0) {
      this.logger.warn('No items found in order, creating placeholder item');
      return [
        {
          name: 'Order Item',
          rate: 0,
          quantity: 1,
          description: 'Imported from Linnworks',
        },
      ];
    }

    return items.map((item, index) => {
      const lineItem: ZohoLineItem = {
        name: this.extractItemName(item, index),
        rate: this.extractItemRate(item),
        quantity: this.extractItemQuantity(item),
      };

      const unit = this.extractItemUnit(item);
      if (unit) lineItem.unit = unit;

      // Add SKU if available - useful for item matching in Zoho
      const sku = this.extractItemSKU(item);
      if (sku) lineItem.sku = sku;

      return lineItem;
    });
  }

  /**
   * Transform Linnworks address to Zoho address
   */
  private transformAddress(address?: any): ZohoBooksAddress | undefined {
    if (!address) return undefined;

    // Only create address if we have meaningful data
    const addressLine = [address.Address1, address.Address2, address.Address3]
      .filter(Boolean)
      .join(', ');

    if (!addressLine && !address.Town && !address.PostCode) {
      return undefined;
    }

    // Apply normalization and Zoho-safe truncation limits
    const MAX_ADDRESS = 100; // Zoho 'address' field limit
    const MAX_CITY = 50;
    const MAX_STATE = 50;
    const MAX_ZIP = 20;
    const MAX_COUNTRY = 50;
    const MAX_ATTENTION = 50;

    return {
      address: this.normalizeAndTrim(addressLine || 'N/A', MAX_ADDRESS),
      city: this.normalizeAndTrim(address.Town || '', MAX_CITY),
      state: this.normalizeAndTrim(address.Region || '', MAX_STATE),
      zip: this.normalizeAndTrim(address.PostCode || '', MAX_ZIP),
      country: this.normalizeAndTrim(address.Country || '', MAX_COUNTRY),
      attention:
        this.normalizeAndTrim(
          address.FullName || address.Company || '',
          MAX_ATTENTION,
          true,
        ) || undefined,
    };
  }

  // Helper methods for field extraction based on actual Linnworks payload structure
  private extractItemName(item: any, index: number): string {
    return (
      item.Title ||
      item.ChannelTitle ||
      item.ItemTitle ||
      item.name ||
      item.Name ||
      `Item ${index + 1}`
    );
  }

  private extractItemRate(item: any): number {
    const rate =
      item.PricePerUnit || item.UnitPrice || item.Rate || item.rate || 0;
    return typeof rate === 'number' ? rate : parseFloat(rate) || 0;
  }

  private extractItemQuantity(item: any): number {
    const quantity = item.Quantity || item.quantity || 1;
    return typeof quantity === 'number' ? quantity : parseInt(quantity) || 1;
  }

  private extractItemUnit(item: any): string | undefined {
    // Default to 'pcs' for most items, or extract if available
    return item.Unit || item.unit || item.UnitOfMeasure || 'pcs';
  }

  private extractItemSKU(item: any): string | undefined {
    return (
      item.SKU || item.sku || item.ItemNumber || item.ChannelSKU || undefined
    );
  }

  private extractShippingCost(order: OrderDto): number {
    const shippingCost =
      order.ShippingInfo?.PostageCost || order.TotalsInfo?.PostageCost || 0;
    return typeof shippingCost === 'number'
      ? shippingCost
      : parseFloat(shippingCost) || 0;
  }

  private formatDate(date?: Date | string): string {
    if (!date) return new Date().toISOString().split('T')[0]; // Today as fallback

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  private mapCurrency(currency?: string): string {
    if (!currency) return 'USD'; // Default currency

    // Map common currencies
    const currencyMap: Record<string, string> = {
      GBP: 'GBP',
      EUR: 'EUR',
      USD: 'USD',
      CAD: 'CAD',
      AUD: 'AUD',
    };

    return currencyMap[currency.toUpperCase()] || currency.toUpperCase();
  }

  private buildReferenceNumber(order: OrderDto): string {
    if (order.GeneralInfo?.ExternalReferenceNum) {
      return `Refurbed-${order.GeneralInfo.ExternalReferenceNum}`;
    } else if (order.GeneralInfo?.ReferenceNum) {
      return `Refurbed-${order.GeneralInfo.ReferenceNum}`;
    }
    // Fallback to Linnworks order number if no external reference
    return `LW-${order.NumOrderId}`;
  }

  private buildOrderNotes(order: OrderDto): string | undefined {
    const notes: string[] = [];

    // Add source information
    if (order.GeneralInfo?.Source) {
      notes.push(`Source: ${order.GeneralInfo.Source}`);
    }

    // Add sub-source if different
    if (
      order.GeneralInfo?.SubSource &&
      order.GeneralInfo.SubSource !== order.GeneralInfo.Source
    ) {
      notes.push(`Channel: ${order.GeneralInfo.SubSource}`);
    }

    // Add external reference if available
    if (order.GeneralInfo?.ExternalReferenceNum) {
      notes.push(`External Ref: ${order.GeneralInfo.ExternalReferenceNum}`);
    }

    // Add secondary reference if different from primary
    if (
      order.GeneralInfo?.SecondaryReference &&
      order.GeneralInfo.SecondaryReference !== order.GeneralInfo.ReferenceNum
    ) {
      notes.push(`Secondary Ref: ${order.GeneralInfo.SecondaryReference}`);
    }

    // Add payment method if available
    if (
      order.TotalsInfo?.PaymentMethod &&
      order.TotalsInfo.PaymentMethod !== 'Default'
    ) {
      notes.push(`Payment: ${order.TotalsInfo.PaymentMethod}`);
    }

    // Add shipping info
    if (
      order.ShippingInfo?.PostalServiceName &&
      order.ShippingInfo.PostalServiceName !== 'Default'
    ) {
      notes.push(`Shipping: ${order.ShippingInfo.PostalServiceName}`);
    }

    return notes.length > 0 ? notes.join(' | ') : undefined;
  }

  private normalizeAndTrim(
    value: string,
    maxLen: number,
    emptyToUndefined = false,
  ): string | undefined {
    if (value == null) return emptyToUndefined ? undefined : '';
    const normalized = String(value)
      .replace(/\s+/g, ' ')
      .replace(/[\r\n]+/g, ' ')
      .trim();
    if (!normalized) return emptyToUndefined ? undefined : '';
    return normalized.length > maxLen
      ? normalized.slice(0, maxLen)
      : normalized;
  }
}
