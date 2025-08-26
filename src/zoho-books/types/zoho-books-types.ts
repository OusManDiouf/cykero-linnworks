export interface Warehouse {
  warehouse_id: string;
  warehouse_name: string;
  warehouse_available_stock: number;
  warehouse_actual_available_stock: number;
  warehouse_committed_stock: number;
  warehouse_actual_committed_stock: number;
  warehouse_available_for_sale_stock: number;
  warehouse_actual_available_for_sale_stock: number;
  warehouse_quantity_in_transit: number;
}
export interface ZohoBookItem {
  item_id: string;
  name: string;
  sku: string;
  warehouses: Warehouse[];
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
