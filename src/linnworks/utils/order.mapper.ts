// A small utility to convert a GetOpenOrders record to our Order schema shape
type OpenOrderAddress = {
  EmailAddress?: string;
  Town?: string;
  PostCode?: string;
  Country?: string;
  FullName?: string;
  Company?: string;
  CountryId?: string;
};

type OpenOrderCustomerInfo = {
  Address?: OpenOrderAddress;
};

type OpenOrderTotalsInfo = {
  TotalCharge?: number;
  TotalDiscount?: number;
  ProfitMargin?: number;
  Currency?: string;
  ConversionRate?: number;
};

type OpenOrderGeneralInfo = {
  Status: number;
  LabelPrinted?: boolean;
  LabelError?: string;
  InvoicePrinted?: boolean;
  PickListPrinted?: boolean;
  IsRuleRun?: boolean;
  Notes?: number;
  PartShipped?: boolean;
  Marker?: number;
  IsParked?: boolean;
  ReferenceNum?: string;
  ReceivedDate?: string;
  Source?: string;
  SubSource?: string;
  HoldOrCancel?: boolean;
  DespatchByDate?: string;
  HasScheduledDelivery?: boolean;
  Location?: string;
  NumItems?: number;
};

type OpenOrderShippingInfo = {
  Vendor?: string;
  PostalServiceName?: string;
  TotalWeight?: number;
  ItemWeight?: number;
  PostageCost?: number;
  PostageCostExTax?: number;
  TrackingNumber?: string;
};

type OpenOrder = {
  OrderId?: string;
  NumOrderId?: number;
  GeneralInfo?: OpenOrderGeneralInfo;
  ShippingInfo?: OpenOrderShippingInfo;
  CustomerInfo?: OpenOrderCustomerInfo;
  TotalsInfo?: OpenOrderTotalsInfo;
  Items?: unknown[];
};

export function mapOpenOrderToOrder(open: OpenOrder): Record<string, unknown> {
  const addr: OpenOrderAddress =
    open.CustomerInfo?.Address ?? ({} as OpenOrderAddress);
  const totals: OpenOrderTotalsInfo =
    open.TotalsInfo ?? ({} as OpenOrderTotalsInfo);
  const gi: OpenOrderGeneralInfo =
    open.GeneralInfo ?? ({} as OpenOrderGeneralInfo);
  const si: OpenOrderShippingInfo =
    open.ShippingInfo ?? ({} as OpenOrderShippingInfo);

  const mappedAddress = {
    CustomerName: addr.FullName || undefined,
    Company: addr.Company || undefined,
    Address1: undefined,
    Address2: undefined,
    Address3: undefined,
    Town: addr.Town || undefined,
    Region: undefined,
    PostCode: addr.PostCode || undefined,
    Country: addr.Country || undefined,
    CountryId: addr.CountryId || undefined,
    PhoneNumber: undefined,
  };

  return {
    orderId: open?.OrderId,
    NumOrderId: open?.NumOrderId,

    GeneralInfo: {
      Status: gi.Status,
      LabelPrinted: gi.LabelPrinted ?? false,
      LabelError: gi.LabelError || undefined,
      InvoicePrinted: gi.InvoicePrinted ?? false,
      PickListPrinted: gi.PickListPrinted ?? false,
      IsRuleRun: gi.IsRuleRun ?? false,
      Notes: gi?.Notes ?? 0,
      PartShipped: gi?.PartShipped ?? false,
      Marker: gi?.Marker ?? 0,
      IsParked: gi?.IsParked ?? false,
      ReferenceNum: gi?.ReferenceNum || undefined,
      ReceivedDate: gi?.ReceivedDate ? new Date(gi.ReceivedDate) : undefined,
      Source: gi?.Source || undefined,
      SubSource: gi?.SubSource || undefined,
      HoldOrCancel: gi?.HoldOrCancel ?? false,
      DespatchByDate:
        gi?.DespatchByDate && gi.DespatchByDate !== '0001-01-01T00:00:00Z'
          ? new Date(gi.DespatchByDate)
          : undefined,
      HasScheduledDelivery: gi?.HasScheduledDelivery ?? false,
      Location: gi?.Location || undefined,
      NumItems: gi?.NumItems ?? 0,
    },

    ShippingInfo: {
      Vendor: si?.Vendor || undefined,
      PostalServiceName: si?.PostalServiceName || undefined,
      TotalWeight: si?.TotalWeight ?? 0,
      ItemWeight: si?.ItemWeight ?? 0,
      PostageCost: si?.PostageCost ?? 0,
      PostageCostExTax: si?.PostageCostExTax ?? 0,
      TrackingNumber: si?.TrackingNumber || undefined,
      // Packaging fields are not present in this payload; they will remain undefined/default
    },

    CustomerInfo: {
      CustomerEmailAddress: addr.EmailAddress || undefined,
      BillingAddress: mappedAddress,
      ShippingAddress: mappedAddress,
      // Other optional CustomerInfo fields not present in this payload will be undefined
    },

    Items: Array.isArray(open?.Items) ? open.Items : [],

    // Totals/root monetary fields
    TotalCharge: totals?.TotalCharge ?? 0,
    TotalDiscount: totals?.TotalDiscount ?? 0,
    ProfitMargin: totals?.ProfitMargin ?? 0,
    Currency: totals?.Currency || 'EUR',
    ConversionRate: totals?.ConversionRate ?? 1,

    // Operational fields
    lastSyncedAt: new Date(),
    // processingStatus/source defaulted by schema if omitted
  };
}
