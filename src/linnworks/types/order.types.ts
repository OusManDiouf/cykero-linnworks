// A DTO helper that replaces the Date-> string recursively.
export type ReplaceDatesWithStrings<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? ReplaceDatesWithStrings<U>[]
    : T extends object
      ? { [K in keyof T]: ReplaceDatesWithStrings<T[K]> }
      : T;

export interface GeneralInfo {
  Status: number;
  LabelPrinted: boolean;
  LabelError: string;
  InvoicePrinted: boolean;
  InvoicePrintError: string;
  PickListPrinted: boolean;
  PickListPrintError: string;
  IsRuleRun: boolean;
  Notes: number;
  PartShipped: boolean;
  Marker: number;
  IsParked: boolean;
  ReferenceNum: string;
  SecondaryReference: string;
  ExternalReferenceNum: string;
  ReceivedDate: Date;
  Source: string;
  SubSource: string;
  HoldOrCancel: boolean;
  DespatchByDate: Date;
  HasScheduledDelivery: boolean;
  Location: string;
  NumItems: number;
}

export interface ShippingInfo {
  Vendor: string;
  PostalServiceId: string;
  PostalServiceName: string;
  TotalWeight: number;
  ItemWeight: number;
  PackageCategoryId: string;
  PackageCategory: string;
  PackageTypeId: string;
  PackageType: string;
  PostageCost: number;
  PostageCostExTax: number;
  TrackingNumber: string;
  ManualAdjust: boolean;
}

export interface AddressLW {
  EmailAddress: string;
  Address1: string;
  Address2: string;
  Address3: string;
  Town: string;
  Region: string;
  PostCode: string;
  Country: string;
  Continent: string;
  FullName: string;
  Company: string;
  PhoneNumber: string;
  CountryId: string;
}

export interface CustomerInfo {
  ChannelBuyerName: string;
  Address: AddressLW;
  BillingAddress: AddressLW;
}

export interface TotalsInfo {
  Subtotal: number;
  PostageCost: number;
  PostageCostExTax: number;
  Tax: number;
  TotalCharge: number;
  PaymentMethod: string;
  PaymentMethodId: string;
  ProfitMargin: number;
  TotalDiscount: number;
  Currency: string;
  CountryTaxRate: number;
  ConversionRate: number;
}

// We'll allow Items and Notes to be flexible (Linnworks sends many fields).
// If later you want them strongly typed, we can lift them out here.
export type OrderItem = Record<string, unknown>;
export type OrderNote = Record<string, unknown>;

// Root domain type to store in Mongo
export interface Order {
  // MongoDB id, we store the Linnworks OrderId here
  _id: string;

  // Mirrors payload keys to keep everything aligned
  OrderId: string;
  NumOrderId: number;
  Processed: boolean;
  FulfilmentLocationId: string;

  GeneralInfo: GeneralInfo;
  ShippingInfo: ShippingInfo;
  CustomerInfo: CustomerInfo;
  TotalsInfo: TotalsInfo;

  ExtendedProperties: Record<string, unknown>[];
  FolderName: string[];

  Items: OrderItem[];
  Notes: OrderNote[];

  // Optional envelope metadata if you want to keep it alongside the order
  // If you don't, just omit these two fields in the mapper.
  connected?: boolean;
  timestamp?: Date;
}

// DTO shapes for inbound/outbound (Dates -> ISO strings)
export type OrderDtoShape = ReplaceDatesWithStrings<Order>;
export type CreateOrderDtoShape = OrderDtoShape;
export type UpdateOrderDtoShape = Partial<OrderDtoShape>;
