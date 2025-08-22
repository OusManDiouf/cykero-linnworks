import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class OrderIdentifier {
  @Prop({ required: true })
  IdentifierId: number;

  @Prop({ required: true })
  IsCustom: boolean;

  @Prop()
  ImageId: string;

  @Prop()
  ImageUrl: string;

  @Prop()
  Tag: string;

  @Prop()
  Name: string;
}

@Schema({ _id: false })
export class ScheduledDelivery {
  @Prop()
  From: Date;

  @Prop()
  To: Date;
}

@Schema({ _id: false })
export class GeneralInfo {
  @Prop({ required: true })
  Status: number;

  @Prop({ default: false })
  LabelPrinted: boolean;

  @Prop()
  LabelError: string;

  @Prop({ default: false })
  InvoicePrinted: boolean;

  @Prop({ default: false })
  PickListPrinted: boolean;

  @Prop({ default: false })
  IsRuleRun: boolean;

  @Prop({ default: 0 })
  Notes: number;

  @Prop({ default: false })
  PartShipped: boolean;

  @Prop({ default: 0 })
  Marker: number;

  @Prop({ default: false })
  IsParked: boolean;

  @Prop({ type: [OrderIdentifier] })
  Identifiers: OrderIdentifier[];

  @Prop()
  ReferenceNum: string;

  @Prop()
  SecondaryReference: string;

  @Prop()
  ExternalReferenceNum: string;

  @Prop()
  ReceivedDate: Date;

  @Prop()
  Source: string;

  @Prop()
  SubSource: string;

  @Prop()
  SiteCode: string;

  @Prop({ default: false })
  HoldOrCancel: boolean;

  @Prop()
  DespatchByDate: Date;

  @Prop({ type: ScheduledDelivery })
  ScheduledDelivery: ScheduledDelivery;

  @Prop({ default: false })
  HasScheduledDelivery: boolean;

  @Prop()
  Location: string;

  @Prop({ default: 0 })
  NumItems: number;
}

@Schema({ _id: false })
export class OrderItem {
  @Prop({ required: true })
  ItemId: string;

  @Prop()
  StockItemId: string;

  @Prop()
  ItemNumber: string;

  @Prop({ required: true })
  SKU: string;

  @Prop({ required: true })
  ItemTitle: string;

  @Prop({ required: true })
  Quantity: number;

  @Prop({ default: 0 })
  UnitCost: number;

  @Prop({ default: 0 })
  UnitPrice: number;

  // Note: define CompositeSubItems in the schema AFTER schema creation to avoid circular metadata recursion
  CompositeSubItems: OrderItem[];
}

@Schema({ _id: false })
export class Address {
  @Prop()
  CustomerName: string;

  @Prop()
  Company: string;

  @Prop()
  Address1: string;

  @Prop()
  Address2: string;

  @Prop()
  Address3: string;

  @Prop()
  Town: string;

  @Prop()
  Region: string;

  @Prop()
  PostCode: string;

  @Prop()
  Country: string;

  @Prop()
  CountryId: string;

  @Prop()
  PhoneNumber: string;
}

@Schema({ _id: false })
export class CustomerInfo {
  @Prop()
  ChannelBuyerName: string;

  @Prop()
  AccountName: string;

  @Prop()
  CustomerTitle: string;

  @Prop()
  CustomerFirstName: string;

  @Prop()
  CustomerLastName: string;

  @Prop()
  CustomerEmailAddress: string;

  @Prop()
  CustomerPhoneNumber: string;

  @Prop({ type: Address })
  BillingAddress: Address;

  @Prop({ type: Address })
  ShippingAddress: Address;
}

@Schema({ _id: false })
export class ShippingInfo {
  @Prop()
  Vendor: string;

  @Prop()
  PostalServiceName: string;

  @Prop()
  PostalServiceTag: string;

  @Prop({ default: 0 })
  TotalWeight: number;

  @Prop({ default: 0 })
  ItemWeight: number;

  @Prop({ default: 0 })
  PackagingWeight: number;

  @Prop()
  PackagingGroup: string;

  @Prop()
  PackagingType: string;

  @Prop({ default: 0 })
  PostageCost: number;

  @Prop({ default: 0 })
  PostageCostExTax: number;

  @Prop()
  TrackingNumber: string;
}

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true })
  orderId: string;

  @Prop({ required: true })
  NumOrderId: number;

  @Prop({ type: GeneralInfo, required: true })
  GeneralInfo: GeneralInfo;

  @Prop({ type: ShippingInfo })
  ShippingInfo: ShippingInfo;

  @Prop({ type: CustomerInfo, required: true })
  CustomerInfo: CustomerInfo;

  @Prop({ type: [OrderItem] })
  Items: OrderItem[];

  @Prop({ type: Map, of: String })
  ExtendedProperties: Map<string, string>;

  @Prop({ default: 0 })
  TotalCharge: number;

  @Prop({ default: 0 })
  TotalDiscount: number;

  @Prop({ default: 0 })
  ProfitMargin: number;

  @Prop({ default: 0 })
  TotalCost: number;

  @Prop({ default: 'EUR' })
  Currency: string;

  @Prop({ default: 1 })
  ConversionRate: number;

  @Prop({ default: 'pending' })
  processingStatus: string;

  @Prop()
  lastSyncedAt: Date;

  @Prop({ default: 'poll' })
  source: string;

  @Prop({ default: 0 })
  retryCount: number;

  @Prop()
  errorMessage: string;
}
export type OrderDocument = HydratedDocument<Order>;

export const OrderSchema = SchemaFactory.createForClass(Order);

// Create indexes
OrderSchema.index({ orderId: 1 }, { unique: true });
OrderSchema.index({ 'GeneralInfo.ReceivedDate': -1 });
OrderSchema.index({ 'GeneralInfo.Status': 1 });
OrderSchema.index({ processingStatus: 1 });
OrderSchema.index({ lastSyncedAt: -1 });

// Define self-referencing subdocument schema AFTER class -> schema creation
export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);
OrderItemSchema.add({ CompositeSubItems: [OrderItemSchema] });
