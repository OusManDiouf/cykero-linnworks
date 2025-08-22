// src/linnworks/dto/order.dto.ts
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsEmail,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

// Leaf DTOs

export class OrderIdentifierDto {
  @IsNumber()
  @IsDefined()
  IdentifierId!: number;

  @IsBoolean()
  @IsDefined()
  IsCustom!: boolean;

  @IsOptional()
  @IsString()
  ImageId?: string;

  @IsOptional()
  @IsString()
  ImageUrl?: string;

  @IsOptional()
  @IsString()
  Tag?: string;

  @IsOptional()
  @IsString()
  Name?: string;
}

export class ScheduledDeliveryDto {
  @IsOptional()
  @IsDateString()
  From?: string;

  @IsOptional()
  @IsDateString()
  To?: string;
}

export class GeneralInfoDto {
  @IsInt()
  @IsDefined()
  Status!: number;

  @IsOptional()
  @IsBoolean()
  LabelPrinted?: boolean;

  @IsOptional()
  @IsString()
  LabelError?: string;

  @IsOptional()
  @IsBoolean()
  InvoicePrinted?: boolean;

  @IsOptional()
  @IsBoolean()
  PickListPrinted?: boolean;

  @IsOptional()
  @IsBoolean()
  IsRuleRun?: boolean;

  @IsOptional()
  @IsInt()
  Notes?: number;

  @IsOptional()
  @IsBoolean()
  PartShipped?: boolean;

  @IsOptional()
  @IsInt()
  Marker?: number;

  @IsOptional()
  @IsBoolean()
  IsParked?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderIdentifierDto)
  Identifiers?: OrderIdentifierDto[];

  @IsOptional()
  @IsString()
  ReferenceNum?: string;

  @IsOptional()
  @IsString()
  SecondaryReference?: string;

  @IsOptional()
  @IsString()
  ExternalReferenceNum?: string;

  @IsOptional()
  @IsDateString()
  ReceivedDate?: string;

  @IsOptional()
  @IsString()
  Source?: string;

  @IsOptional()
  @IsString()
  SubSource?: string;

  @IsOptional()
  @IsString()
  SiteCode?: string;

  @IsOptional()
  @IsBoolean()
  HoldOrCancel?: boolean;

  @IsOptional()
  @IsDateString()
  DespatchByDate?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduledDeliveryDto)
  ScheduledDelivery?: ScheduledDeliveryDto;

  @IsOptional()
  @IsBoolean()
  HasScheduledDelivery?: boolean;

  @IsOptional()
  @IsString()
  Location?: string;

  @IsOptional()
  @IsInt()
  NumItems?: number;
}

export class AddressDto {
  @IsOptional()
  @IsString()
  CustomerName?: string;

  @IsOptional()
  @IsString()
  Company?: string;

  @IsOptional()
  @IsString()
  Address1?: string;

  @IsOptional()
  @IsString()
  Address2?: string;

  @IsOptional()
  @IsString()
  Address3?: string;

  @IsOptional()
  @IsString()
  Town?: string;

  @IsOptional()
  @IsString()
  Region?: string;

  @IsOptional()
  @IsString()
  PostCode?: string;

  @IsOptional()
  @IsString()
  Country?: string;

  @IsOptional()
  @IsString()
  CountryId?: string;

  @IsOptional()
  @IsString()
  PhoneNumber?: string;
}

export class CustomerInfoDto {
  @IsOptional()
  @IsString()
  ChannelBuyerName?: string;

  @IsOptional()
  @IsString()
  AccountName?: string;

  @IsOptional()
  @IsString()
  CustomerTitle?: string;

  @IsOptional()
  @IsString()
  CustomerFirstName?: string;

  @IsOptional()
  @IsString()
  CustomerLastName?: string;

  @IsOptional()
  @IsEmail()
  CustomerEmailAddress?: string;

  @IsOptional()
  @IsString()
  CustomerPhoneNumber?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  BillingAddress?: AddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  ShippingAddress?: AddressDto;
}

export class ShippingInfoDto {
  @IsOptional()
  @IsString()
  Vendor?: string;

  @IsOptional()
  @IsString()
  PostalServiceName?: string;

  @IsOptional()
  @IsString()
  PostalServiceTag?: string;

  @IsOptional()
  @IsNumber()
  TotalWeight?: number;

  @IsOptional()
  @IsNumber()
  ItemWeight?: number;

  @IsOptional()
  @IsNumber()
  PackagingWeight?: number;

  @IsOptional()
  @IsString()
  PackagingGroup?: string;

  @IsOptional()
  @IsString()
  PackagingType?: string;

  @IsOptional()
  @IsNumber()
  PostageCost?: number;

  @IsOptional()
  @IsNumber()
  PostageCostExTax?: number;

  @IsOptional()
  @IsString()
  TrackingNumber?: string;
}

export class OrderItemDto {
  @IsString()
  @IsDefined()
  ItemId!: string;

  @IsOptional()
  @IsString()
  StockItemId?: string;

  @IsOptional()
  @IsString()
  ItemNumber?: string;

  @IsString()
  @IsDefined()
  SKU!: string;

  @IsString()
  @IsDefined()
  ItemTitle!: string;

  @IsInt()
  @IsDefined()
  Quantity!: number;

  @IsOptional()
  @IsNumber()
  UnitCost?: number;

  @IsOptional()
  @IsNumber()
  UnitPrice?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  CompositeSubItems?: OrderItemDto[];
}

// Root DTOs

// Flexible “general” DTO for transfers/responses/usages across layers.
// Most fields are optional; use CreateOrderDto for enforcing minimum required on creation.
export class OrderDto {
  @IsString()
  @IsDefined()
  orderId!: string;

  @IsInt()
  @IsDefined()
  NumOrderId!: number;

  @ValidateNested()
  @Type(() => GeneralInfoDto)
  @IsDefined()
  GeneralInfo!: GeneralInfoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingInfoDto)
  ShippingInfo?: ShippingInfoDto;

  @ValidateNested()
  @Type(() => CustomerInfoDto)
  @IsDefined()
  CustomerInfo!: CustomerInfoDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  Items?: OrderItemDto[];

  // Represent Map<string,string> as a POJO for DTO usage
  @IsOptional()
  @IsObject()
  ExtendedProperties?: Record<string, string>;

  @IsOptional()
  @IsNumber()
  TotalCharge?: number;

  @IsOptional()
  @IsNumber()
  TotalDiscount?: number;

  @IsOptional()
  @IsNumber()
  ProfitMargin?: number;

  @IsOptional()
  @IsNumber()
  TotalCost?: number;

  @IsOptional()
  @IsString()
  Currency?: string;

  @IsOptional()
  @IsNumber()
  ConversionRate?: number;

  @IsOptional()
  @IsString()
  processingStatus?: string;

  @IsOptional()
  @IsDateString()
  lastSyncedAt?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsInt()
  retryCount?: number;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}

// Enforce a minimal set needed for creating a valid Order record
// Requires: orderId, NumOrderId, GeneralInfo.Status, and CustomerInfo (object may be empty)
export class CreateOrderDto extends OrderDto {}

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
export class UpdateOrderDto extends PartialType(OrderDto) {}
