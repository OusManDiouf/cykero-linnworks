import { Order as OrderShape } from '../types/order.types';
import { OrderDto } from '../dto/order.dto';

// Convert the inbound payload into our domain (Mongo) shape
export function mapLinnworksOrderEnvelopeToOrder(o: OrderDto): OrderShape {
  const toDate = (s?: string) =>
    s && s !== '0001-01-01T00:00:00Z' ? new Date(s) : undefined;

  return {
    _id: o.OrderId, // critical: we store Linnworks OrderId as Mongo _id
    OrderId: o.OrderId,

    NumOrderId: o.NumOrderId,
    Processed: o.Processed,
    FulfilmentLocationId:
      o.FulfilmentLocationId ?? '00000000-0000-0000-0000-000000000000',

    GeneralInfo: {
      Status: o.GeneralInfo?.Status ?? 0,
      LabelPrinted: !!o.GeneralInfo?.LabelPrinted,
      LabelError: o.GeneralInfo?.LabelError ?? '',
      InvoicePrinted: !!o.GeneralInfo?.InvoicePrinted,
      InvoicePrintError: o.GeneralInfo?.InvoicePrintError ?? '',
      PickListPrinted: !!o.GeneralInfo?.PickListPrinted,
      PickListPrintError: o.GeneralInfo?.PickListPrintError ?? '',
      IsRuleRun: !!o.GeneralInfo?.IsRuleRun,
      Notes: o.GeneralInfo?.Notes ?? 0,
      PartShipped: !!o.GeneralInfo?.PartShipped,
      Marker: o.GeneralInfo?.Marker ?? 0,
      IsParked: !!o.GeneralInfo?.IsParked,
      ReferenceNum: o.GeneralInfo?.ReferenceNum ?? '',
      SecondaryReference: o.GeneralInfo?.SecondaryReference ?? '',
      ExternalReferenceNum: o.GeneralInfo?.ExternalReferenceNum ?? '',
      ReceivedDate: toDate(o.GeneralInfo?.ReceivedDate) ?? new Date(),
      Source: o.GeneralInfo?.Source ?? '',
      SubSource: o.GeneralInfo?.SubSource ?? '',
      HoldOrCancel: !!o.GeneralInfo?.HoldOrCancel,
      DespatchByDate: toDate(o.GeneralInfo?.DespatchByDate) ?? new Date(),
      HasScheduledDelivery: !!o.GeneralInfo?.HasScheduledDelivery,
      Location:
        o.GeneralInfo?.Location ?? '00000000-0000-0000-0000-000000000000',
      NumItems:
        o.GeneralInfo?.NumItems ??
        (Array.isArray(o.Items) ? o.Items.length : 0),
    },

    ShippingInfo: {
      Vendor: o.ShippingInfo?.Vendor ?? '',
      PostalServiceId: o.ShippingInfo?.PostalServiceId ?? '',
      PostalServiceName: o.ShippingInfo?.PostalServiceName ?? '',
      TotalWeight: o.ShippingInfo?.TotalWeight ?? 0,
      ItemWeight: o.ShippingInfo?.ItemWeight ?? 0,
      PackageCategoryId: o.ShippingInfo?.PackageCategoryId ?? '',
      PackageCategory: o.ShippingInfo?.PackageCategory ?? '',
      PackageTypeId: o.ShippingInfo?.PackageTypeId ?? '',
      PackageType: o.ShippingInfo?.PackageType ?? '',
      PostageCost: o.ShippingInfo?.PostageCost ?? 0,
      PostageCostExTax: o.ShippingInfo?.PostageCostExTax ?? 0,
      TrackingNumber: o.ShippingInfo?.TrackingNumber ?? '',
      ManualAdjust: !!o.ShippingInfo?.ManualAdjust,
    },

    CustomerInfo: {
      ChannelBuyerName: o.CustomerInfo?.ChannelBuyerName ?? '',
      Address: {
        EmailAddress: o.CustomerInfo?.Address?.EmailAddress ?? '',
        Address1: o.CustomerInfo?.Address?.Address1 ?? '',
        Address2: o.CustomerInfo?.Address?.Address2 ?? '',
        Address3: o.CustomerInfo?.Address?.Address3 ?? '',
        Town: o.CustomerInfo?.Address?.Town ?? '',
        Region: o.CustomerInfo?.Address?.Region ?? '',
        PostCode: o.CustomerInfo?.Address?.PostCode ?? '',
        Country: o.CustomerInfo?.Address?.Country ?? '',
        Continent: o.CustomerInfo?.Address?.Continent ?? '',
        FullName: o.CustomerInfo?.Address?.FullName ?? '',
        Company: o.CustomerInfo?.Address?.Company ?? '',
        PhoneNumber: o.CustomerInfo?.Address?.PhoneNumber ?? '',
        CountryId: o.CustomerInfo?.Address?.CountryId ?? '',
      },
      BillingAddress: {
        EmailAddress: o.CustomerInfo?.BillingAddress?.EmailAddress ?? '',
        Address1: o.CustomerInfo?.BillingAddress?.Address1 ?? '',
        Address2: o.CustomerInfo?.BillingAddress?.Address2 ?? '',
        Address3: o.CustomerInfo?.BillingAddress?.Address3 ?? '',
        Town: o.CustomerInfo?.BillingAddress?.Town ?? '',
        Region: o.CustomerInfo?.BillingAddress?.Region ?? '',
        PostCode: o.CustomerInfo?.BillingAddress?.PostCode ?? '',
        Country: o.CustomerInfo?.BillingAddress?.Country ?? '',
        Continent: o.CustomerInfo?.BillingAddress?.Continent ?? '',
        FullName: o.CustomerInfo?.BillingAddress?.FullName ?? '',
        Company: o.CustomerInfo?.BillingAddress?.Company ?? '',
        PhoneNumber: o.CustomerInfo?.BillingAddress?.PhoneNumber ?? '',
        CountryId: o.CustomerInfo?.BillingAddress?.CountryId ?? '',
      },
    },

    TotalsInfo: {
      Subtotal: o.TotalsInfo?.Subtotal ?? 0,
      PostageCost: o.TotalsInfo?.PostageCost ?? 0,
      PostageCostExTax: o.TotalsInfo?.PostageCostExTax ?? 0,
      Tax: o.TotalsInfo?.Tax ?? 0,
      TotalCharge: o.TotalsInfo?.TotalCharge ?? 0,
      PaymentMethod: o.TotalsInfo?.PaymentMethod ?? '',
      PaymentMethodId: o.TotalsInfo?.PaymentMethodId ?? '',
      ProfitMargin: o.TotalsInfo?.ProfitMargin ?? 0,
      TotalDiscount: o.TotalsInfo?.TotalDiscount ?? 0,
      Currency: o.TotalsInfo?.Currency ?? 'EUR',
      CountryTaxRate: o.TotalsInfo?.CountryTaxRate ?? 0,
      ConversionRate: o.TotalsInfo?.ConversionRate ?? 1,
    },

    ExtendedProperties: Array.isArray(o.ExtendedProperties)
      ? o.ExtendedProperties
      : [],

    FolderName: Array.isArray(o.FolderName) ? o.FolderName : [],

    Items: Array.isArray(o.Items) ? o.Items : [],
    Notes: Array.isArray(o.Notes) ? o.Notes : [],
  };
}
