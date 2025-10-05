export interface Location {
  location_id: string;
  location_name: string;
  location_available_stock: number;
  location_actual_available_stock: number;
  location_committed_stock: number;
  location_actual_committed_stock: number;
  location_available_for_sale_stock: number;
  location_actual_available_for_sale_stock: number;
  location_quantity_in_transit: number;
}
export interface ZohoBookItem {
  item_id: string;
  name: string;
  sku: string;
  locations: Location[];
}
export interface ZohoBookItemResponse {
  code: number;
  message: string;
  item?: ZohoBookItem;
}
export interface ZohoBookItemsResponse {
  code: number;
  message: string;
  items: ZohoBookItem[];
  page_context: {
    page: number;
    per_page: number;
    has_more_page: boolean;
  };
}

export interface ZohoBooksSalesOrderRequest {
  customer_id: string;
  date?: string;
  line_items: ZohoLineItem[];
  currency_code?: string;
  reference_number?: string;
  billing_address?: ZohoBooksAddress;
  shipping_address?: ZohoBooksAddress;
  notes?: string;
  shipping_charge?: number;
  bcy_shipping_charge?: number;
  is_inclusive_tax: boolean;
  location_id?: string;
}

export interface ZohoLineItem {
  name?: string;
  rate?: number;
  quantity?: number;
  description?: string;
  unit?: string;
  sku?: string; // Item SKU for matching existing Zoho items
  item_id?: string; // Optional - Zoho will create items if not provided
}

export interface ZohoBooksSalesOrderResponse {
  code: number;
  message: string;
  salesorder?: {
    salesorder_id: string;
    salesorder_number: string;
    status: string;
    total: number;
    customer_name: string;
  };
}

// CUSTOMER
export interface ZohoBooksAddress {
  attention?: string;
  address?: string;
  street2?: string;
  city?: string;
  state_code?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

export interface ZohoContactPerson {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
}

export interface CreateZohoCustomerParams {
  contact_name: string;
  company_name?: string;
  first_name?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  contact_type?: 'customer';
  billing_address?: ZohoBooksAddress;
  shipping_address?: ZohoBooksAddress;
  contact_persons?: ZohoContactPerson[];
  custom_fields?: Array<{ label: string; value: string }>;
}

export interface ZohoContact {
  contact_id: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  billing_address?: ZohoBooksAddress;
  shipping_address?: ZohoBooksAddress;
}

export interface SearchZohoContactResult {
  apiError: boolean;
  contactExists: boolean;
  contactId?: string;
  errorMessage?: string;
}

/**
 * Lightweight Zoho Item type (extend as needed)
 */
export interface ZohoItem {
  item_id: string;
  name?: string;
  sku?: string;
  rate?: number;
  status?: string;
  product_type?: string;
  tax_id: string;
  locations: ZohoLocation[];
}

//STOCK UPDATE INTEGRATION TYPES
export type ZohoWebhookResource =
  | 'salesorder'
  | 'purchasereceive'
  | 'inventory_adjustment'
  | 'vendor_credit'
  | 'creditnote';

export interface ZohoWebhookLineItem {
  item_id: string;
  sku: string;
}

export interface ZohoWebhookResourcePayload {
  line_items: ZohoWebhookLineItem[];
}
export type ZohoWebhookPayload = Partial<
  Record<ZohoWebhookResource, ZohoWebhookResourcePayload>
>;

export interface ZohoLocation {
  location_id: string;
  location_actual_available_for_sale_stock: number;
  location_name: string;
}

export interface StockUpdateItem {
  itemSKU: string;
  itemStocksCount: number;
  locationName: string;
  zohoLocationId?: string;
}

export interface LinnworksStockLevelUpdate {
  SKU: string;
  LocationId: string;
  Level: number;
}
