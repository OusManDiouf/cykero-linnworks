import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from 'mongoose';
import {
  AddressLW as AddressShape,
  CustomerInfo as CustomerInfoShape,
  GeneralInfo as GeneralInfoShape,
  Order as OrderShape,
  ShippingInfo as ShippingInfoShape,
  TotalsInfo as TotalsInfoShape,
} from '../types/order.types';

// Address schema (strict false to allow extra fields without constant churn)
@Schema({ _id: false, strict: true })
export class Address implements AddressShape {
  @Prop({ default: '' }) EmailAddress: string;
  @Prop({ default: '' }) Address1: string;
  @Prop({ default: '' }) Address2: string;
  @Prop({ default: '' }) Address3: string;
  @Prop({ default: '' }) Town: string;
  @Prop({ default: '' }) Region: string;
  @Prop({ default: '' }) PostCode: string;
  @Prop({ default: '' }) Country: string;
  @Prop({ default: '' }) Continent: string;
  @Prop({ default: '' }) FullName: string;
  @Prop({ default: '' }) Company: string;
  @Prop({ default: '' }) PhoneNumber: string;
  @Prop({ default: '' }) CountryId: string;
}

// GeneralInfo matches payload
@Schema({ _id: false })
export class GeneralInfo implements GeneralInfoShape {
  @Prop({ required: true }) Status: number;
  @Prop({ default: false }) LabelPrinted: boolean;
  @Prop({ default: '' }) LabelError: string;
  @Prop({ default: false }) InvoicePrinted: boolean;
  @Prop({ default: '' }) InvoicePrintError: string;
  @Prop({ default: false }) PickListPrinted: boolean;
  @Prop({ default: '' }) PickListPrintError: string;
  @Prop({ default: false }) IsRuleRun: boolean;
  @Prop({ default: 0 }) Notes: number;
  @Prop({ default: false }) PartShipped: boolean;
  @Prop({ default: 0 }) Marker: number;
  @Prop({ default: false }) IsParked: boolean;
  @Prop({ default: '' }) ReferenceNum: string;
  @Prop({ default: '' }) SecondaryReference: string;
  @Prop({ default: '' }) ExternalReferenceNum: string;
  @Prop() ReceivedDate: Date;
  @Prop({ default: '' }) Source: string;
  @Prop({ default: '' }) SubSource: string;
  @Prop({ default: false }) HoldOrCancel: boolean;
  @Prop() DespatchByDate: Date;
  @Prop({ default: false }) HasScheduledDelivery: boolean;
  @Prop({ default: '' }) Location: string;
  @Prop({ default: 0 }) NumItems: number;
}

// ShippingInfo matches payload
@Schema({ _id: false })
export class ShippingInfo implements ShippingInfoShape {
  @Prop({ default: '' }) Vendor: string;
  @Prop({ default: '' }) PostalServiceId: string;
  @Prop({ default: '' }) PostalServiceName: string;
  @Prop({ default: 0 }) TotalWeight: number;
  @Prop({ default: 0 }) ItemWeight: number;
  @Prop({ default: '' }) PackageCategoryId: string;
  @Prop({ default: '' }) PackageCategory: string;
  @Prop({ default: '' }) PackageTypeId: string;
  @Prop({ default: '' }) PackageType: string;
  @Prop({ default: 0 }) PostageCost: number;
  @Prop({ default: 0 }) PostageCostExTax: number;
  @Prop({ default: '' }) TrackingNumber: string;
  @Prop({ default: false }) ManualAdjust: boolean;
}

// TotalsInfo matches payload
@Schema({ _id: false })
export class TotalsInfo implements TotalsInfoShape {
  @Prop({ default: 0 }) Subtotal: number;
  @Prop({ default: 0 }) PostageCost: number;
  @Prop({ default: 0 }) PostageCostExTax: number;
  @Prop({ default: 0 }) Tax: number;
  @Prop({ default: 0 }) TotalCharge: number;
  @Prop({ default: '' }) PaymentMethod: string;
  @Prop({ default: '' }) PaymentMethodId: string;
  @Prop({ default: 0 }) ProfitMargin: number;
  @Prop({ default: 0 }) TotalDiscount: number;
  @Prop({ default: 'EUR' }) Currency: string;
  @Prop({ default: 0 }) CountryTaxRate: number;
  @Prop({ default: 1 }) ConversionRate: number;
}

// CustomerInfo matches payload
@Schema({ _id: false })
export class CustomerInfo implements CustomerInfoShape {
  @Prop({ default: '' }) ChannelBuyerName: string;

  @Prop({ type: Address, required: true })
  Address: Address;

  @Prop({ type: Address, required: true })
  BillingAddress: Address;
}

@Schema({
  // Important: include virtuals so OrderId is visible in JSON/objects
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Order implements Omit<OrderShape, 'OrderId'> {
  // Use Linnworks OrderId as Mongo _id
  @Prop({ type: String, required: true })
  _id: string;

  // Full payload fields
  @Prop({ required: true })
  NumOrderId: number;

  @Prop({ default: false })
  Processed: boolean;

  @Prop({ default: '00000000-0000-0000-0000-000000000000' })
  FulfilmentLocationId: string;

  @Prop({ type: GeneralInfo, required: true })
  GeneralInfo: GeneralInfo;

  @Prop({ type: ShippingInfo, required: true })
  ShippingInfo: ShippingInfo;

  @Prop({ type: CustomerInfo, required: true })
  CustomerInfo: CustomerInfo;

  @Prop({ type: TotalsInfo, required: true })
  TotalsInfo: TotalsInfo;

  // Arrays can be flexible
  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  ExtendedProperties: Record<string, unknown>[];

  @Prop({ type: [String], default: [] })
  FolderName: string[];

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  Items: Record<string, unknown>[];

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  Notes: Record<string, unknown>[];

  // Optional envelope metadata if you want to keep them
  @Prop()
  connected?: boolean;

  @Prop()
  timestamp?: Date;

  // SYNC FIELDS
  @Prop({ default: 'pending' }) // pending, synced, failed
  syncStatus: string;

  @Prop()
  syncedAt: Date;

  @Prop()
  syncError: string;

  @Prop({ default: 0 })
  syncRetries: number;

  // === Mapping to Zoho (needed to resolve incoming webhooks) ===
  @Prop({ type: String, index: true })
  zohoSalesOrderId?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Virtual to expose "OrderId" as an alias to _id to match your payload exactly
OrderSchema.virtual('OrderId')
  .get(function (this: { _id: string }) {
    return this._id;
  })
  .set(function (this: { _id: string }, v: string) {
    this._id = v;
  });

// Helpful indexes
OrderSchema.index({ 'GeneralInfo.ReceivedDate': -1 });
OrderSchema.index({ 'GeneralInfo.Status': 1 });
OrderSchema.index({ 'ShippingInfo.TrackingNumber': 1 });
