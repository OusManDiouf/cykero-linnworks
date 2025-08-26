// DTOs that implement shared shapes (Dates replaced with strings)
// Keep validators minimal and practical.

import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AddressLW as AddressShape,
  CustomerInfo as CustomerInfoShape,
  GeneralInfo as GeneralInfoShape,
  OrderDtoShape,
  ShippingInfo as ShippingInfoShape,
  TotalsInfo as TotalsInfoShape,
} from '../types/order.types';

export class AddressDto implements AddressShape {
  @IsString() @IsOptional() EmailAddress!: string;
  @IsString() @IsOptional() Address1!: string;
  @IsString() @IsOptional() Address2!: string;
  @IsString() @IsOptional() Address3!: string;
  @IsString() @IsOptional() Town!: string;
  @IsString() @IsOptional() Region!: string;
  @IsString() @IsOptional() PostCode!: string;
  @IsString() @IsOptional() Country!: string;
  @IsString() @IsOptional() Continent!: string;
  @IsString() @IsOptional() FullName!: string;
  @IsString() @IsOptional() Company!: string;
  @IsString() @IsOptional() PhoneNumber!: string;
  @IsString() @IsOptional() CountryId!: string;
}

export class GeneralInfoDto
  implements Omit<GeneralInfoShape, 'ReceivedDate' | 'DespatchByDate'>
{
  @IsNumber() @IsDefined() Status!: number;
  @IsBoolean() @IsOptional() LabelPrinted!: boolean;
  @IsString() @IsOptional() LabelError!: string;
  @IsBoolean() @IsOptional() InvoicePrinted!: boolean;
  @IsString() @IsOptional() InvoicePrintError!: string;
  @IsBoolean() @IsOptional() PickListPrinted!: boolean;
  @IsString() @IsOptional() PickListPrintError!: string;
  @IsBoolean() @IsOptional() IsRuleRun!: boolean;
  @IsNumber() @IsOptional() Notes!: number;
  @IsBoolean() @IsOptional() PartShipped!: boolean;
  @IsNumber() @IsOptional() Marker!: number;
  @IsBoolean() @IsOptional() IsParked!: boolean;
  @IsString() @IsOptional() ReferenceNum!: string;
  @IsString() @IsOptional() SecondaryReference!: string;
  @IsString() @IsOptional() ExternalReferenceNum!: string;
  @IsString() @IsOptional() Source!: string;
  @IsString() @IsOptional() SubSource!: string;
  @IsBoolean() @IsOptional() HoldOrCancel!: boolean;
  @IsBoolean() @IsOptional() HasScheduledDelivery!: boolean;
  @IsString() @IsOptional() Location!: string;
  @IsNumber() @IsOptional() NumItems!: number;

  // @IsDateString() @IsOptional() ReceivedDate?: string;
  // @IsDateString() @IsOptional() DespatchByDate?: string;
  @IsDateString()
  @IsDefined()
  ReceivedDate!: string;

  @IsDateString()
  @IsDefined()
  DespatchByDate!: string;
}

export class ShippingInfoDto implements ShippingInfoShape {
  @IsString() @IsOptional() Vendor!: string;
  @IsString() @IsOptional() PostalServiceId!: string;
  @IsString() @IsOptional() PostalServiceName!: string;
  @IsNumber() @IsOptional() TotalWeight!: number;
  @IsNumber() @IsOptional() ItemWeight!: number;
  @IsString() @IsOptional() PackageCategoryId!: string;
  @IsString() @IsOptional() PackageCategory!: string;
  @IsString() @IsOptional() PackageTypeId!: string;
  @IsString() @IsOptional() PackageType!: string;
  @IsNumber() @IsOptional() PostageCost!: number;
  @IsNumber() @IsOptional() PostageCostExTax!: number;
  @IsString() @IsOptional() TrackingNumber!: string;
  @IsBoolean() @IsOptional() ManualAdjust!: boolean;
}

export class TotalsInfoDto implements TotalsInfoShape {
  @IsNumber() @IsOptional() Subtotal!: number;
  @IsNumber() @IsOptional() PostageCost!: number;
  @IsNumber() @IsOptional() PostageCostExTax!: number;
  @IsNumber() @IsOptional() Tax!: number;
  @IsNumber() @IsOptional() TotalCharge!: number;
  @IsString() @IsOptional() PaymentMethod!: string;
  @IsString() @IsOptional() PaymentMethodId!: string;
  @IsNumber() @IsOptional() ProfitMargin!: number;
  @IsNumber() @IsOptional() TotalDiscount!: number;
  @IsString() @IsOptional() Currency!: string;
  @IsNumber() @IsOptional() CountryTaxRate!: number;
  @IsNumber() @IsOptional() ConversionRate!: number;
}

export class CustomerInfoDto implements Omit<CustomerInfoShape, never> {
  @IsString() @IsOptional() ChannelBuyerName!: string;

  @ValidateNested()
  @Type(() => AddressDto)
  Address!: AddressDto;

  @ValidateNested()
  @Type(() => AddressDto)
  BillingAddress!: AddressDto;
}

export class OrderDto implements OrderDtoShape {
  // Mongo's id as a string, mirrored to OrderId in API plane
  @IsString() @IsDefined() _id!: string;

  @IsString() @IsDefined() OrderId!: string;
  @IsNumber() @IsDefined() NumOrderId!: number;
  @IsBoolean() @IsOptional() Processed!: boolean;
  @IsString() @IsOptional() FulfilmentLocationId!: string;

  @ValidateNested()
  @Type(() => GeneralInfoDto)
  GeneralInfo!: GeneralInfoDto;

  @ValidateNested()
  @Type(() => ShippingInfoDto)
  ShippingInfo!: ShippingInfoDto;

  @ValidateNested()
  @Type(() => CustomerInfoDto)
  CustomerInfo!: CustomerInfoDto;

  @ValidateNested()
  @Type(() => TotalsInfoDto)
  TotalsInfo!: TotalsInfoDto;

  @IsArray()
  @IsOptional()
  ExtendedProperties!: Record<string, unknown>[];

  @IsArray()
  @IsOptional()
  FolderName!: string[];

  @IsArray()
  @IsOptional()
  Items!: Record<string, unknown>[];

  @IsArray()
  @IsOptional()
  Notes!: Record<string, unknown>[];

  @IsBoolean()
  @IsOptional()
  connected?: boolean;

  @IsDateString()
  @IsOptional()
  timestamp?: string;
}
