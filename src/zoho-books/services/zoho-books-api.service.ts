import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ZohoAuthService } from './zoho-auth.service';
import { ConfigService } from '@nestjs/config';
import {
  CreateZohoCustomerParams,
  SearchZohoContactResult,
  StockUpdateItem,
  Warehouse,
  ZohoBookItem,
  ZohoBookItemResponse,
  ZohoBookItemsResponse,
  ZohoBooksSalesOrderRequest,
  ZohoBooksSalesOrderResponse,
  ZohoContact,
  ZohoItem,
  ZohoWebhookLineItem,
} from '../types/zoho-books-types';
import Bottleneck from 'bottleneck';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, map, retry } from 'rxjs';

@Injectable()
export class ZohoBooksApiService {
  private readonly logger = new Logger(ZohoBooksApiService.name);
  private readonly maxRetries: number = 2;

  private readonly GMBH_WAREHOUSE_ID = '347732000000070863';
  private readonly SAS_WAREHOUSE_ID = '347732000000070865';

  private readonly ZOHO_BOOK_API: string;
  private readonly ORGANIZATION_ID: string;

  private readonly limiter = new Bottleneck({
    maxConcurrent: 5,
    minTime: 500,
  });

  constructor(
    private readonly zohoAuthService: ZohoAuthService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    if (!this.configService.get('ZOHO_BOOK_API')) {
      throw new Error('ZOHO_BOOK_API is not set');
    }
    if (!this.configService.get('ZOHO_BOOK_ORGANIZATION_ID')) {
      throw new Error('ZOHO_BOOK_ORGANIZATION_ID is not set');
    }
    this.ZOHO_BOOK_API = this.configService.get('ZOHO_BOOK_API') as string;
    this.ORGANIZATION_ID = this.configService.get(
      'ZOHO_BOOK_ORGANIZATION_ID',
    ) as string;
  }

  private async getAccessToken(): Promise<string> {
    return this.zohoAuthService.getAccessToken();
  }

  private contactsUrl(): string {
    return `${this.ZOHO_BOOK_API}/contacts?organization_id=${this.ORGANIZATION_ID}`;
  }
  private contactByIdUrl(contactId: string): string {
    return `${this.ZOHO_BOOK_API}/contacts/${contactId}?organization_id=${this.ORGANIZATION_ID}`;
  }

  // --- Items helpers ---
  private itemsUrl(): string {
    return `${this.ZOHO_BOOK_API}/items?organization_id=${this.ORGANIZATION_ID}`;
  }

  /**
   * Extract item IDs from webhook line items
   */
  public getItemIds(items: ZohoWebhookLineItem[]): string[] {
    return items.map(({ item_id }) => item_id);
  }

  /**
   * Get all item details from Zoho Inventory API
   */
  public async getAllItemDetails(itemIds: string[]): Promise<ZohoItem[]> {
    if (itemIds.length === 0) return [];

    // Sanitize: trim, remove empty/falsy, deduplicate
    const cleanIds = Array.from(
      new Set(
        itemIds
          .map((id) => (id ?? '').toString().trim())
          .filter((id) => id.length > 0),
      ),
    );

    if (cleanIds.length === 0) {
      this.logger.warn(
        '⚠️  getAllItemDetails called with only empty/invalid itemIds',
      );
      return [];
    }

    // Batch requests to avoid overly long URLs or API-side limits
    const BATCH_SIZE = 50;
    const batches: string[][] = [];
    for (let i = 0; i < cleanIds.length; i += BATCH_SIZE) {
      batches.push(cleanIds.slice(i, i + BATCH_SIZE));
    }

    try {
      const accessToken = await this.zohoAuthService.getAccessToken();

      const allItems: ZohoItem[] = [];
      for (const batch of batches) {
        const url = new URL(`${this.ZOHO_BOOK_API}/itemdetails`);
        url.searchParams.append('organization_id', this.ORGANIZATION_ID);
        url.searchParams.append('item_ids', batch.join(','));

        const response = await firstValueFrom(
          this.httpService.get(url.toString(), {
            headers: {
              Authorization: `Zoho-oauthtoken ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }),
        );

        const items = (response.data.items as ZohoItem[]) ?? [];
        allItems.push(
          ...items.map((item) => ({
            item_id: item.item_id,
            name: item.name,
            tax_id: item.tax_id,
            sku: item.sku,
            rate: item.rate,
            status: item.status,
            warehouses: (item.warehouses ?? []).map((wh) => ({
              warehouse_id: wh.warehouse_id,
              warehouse_name: wh.warehouse_name,
              warehouse_actual_available_for_sale_stock:
                wh.warehouse_actual_available_for_sale_stock,
            })),
          })),
        );
      }

      return allItems;
    } catch (error: any) {
      this.logger.error(
        '❌ Failed to fetch item details from Zoho:',
        error?.response?.data || error?.message,
      );
      throw error;
    }
  }

  // /**
  //  * Calculate stock levels by warehouse from Zoho items
  //  */
  // public getAggregateStocksItemByWarehouses(
  //   items: ZohoItem[],
  //   targetWarehouses: string[] = [this.GMBH_WAREHOUSE_ID],
  // ): StockUpdateItem[] {
  //   return items
  //     .filter(
  //       (item): item is ZohoItem & { sku: string } =>
  //         typeof item.sku === 'string' && item.sku.length > 0,
  //     )
  //     .map((item) => {
  //       const totalStock = item.warehouses
  //         .filter((warehouse) =>
  //           targetWarehouses.includes(warehouse.warehouse_id),
  //         )
  //         .reduce((total, warehouse) => {
  //           return total + warehouse.warehouse_actual_available_for_sale_stock;
  //         }, 0);
  //
  //       return {
  //         itemSKU: item.sku,
  //         itemStocksCount: totalStock,
  //         warehouseName: wa
  //       };
  //     });
  // }

  /**
   * Calculate stock levels by warehouse from Zoho items
   * Returns one entry per target warehouse (no summing)
   */
  public getStocksItemByWarehouse(
    items: ZohoItem[],
    targetWarehouses: string[] = [this.GMBH_WAREHOUSE_ID],
  ): StockUpdateItem[] {
    return items
      .filter(
        (item): item is ZohoItem & { sku: string } =>
          typeof item.sku === 'string' && item.sku.length > 0,
      )
      .flatMap((item) => {
        const matchedWarehouses = item.warehouses.filter((warehouse) =>
          targetWarehouses.includes(warehouse.warehouse_id),
        );

        return matchedWarehouses.map((warehouse) => ({
          itemSKU: item.sku,
          itemStocksCount: warehouse.warehouse_actual_available_for_sale_stock,
          warehouseName: warehouse.warehouse_name,
          // If needed later and the type allows, you can include the warehouse ID:
          // warehouseId: warehouse.warehouse_id,
        }));
      });
  }

  /**
   * Fetch a Zoho Books item by its SKU (no local caching).
   * Throws if no item is found.
   */
  public async getItemBySku(sku: string): Promise<ZohoItem> {
    const url = `${this.itemsUrl()}&sku=${encodeURIComponent(sku)}`;

    const res = await firstValueFrom(
      this.httpService
        .get(url, {
          headers: {
            Authorization: `Zoho-oauthtoken ${await this.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        })
        .pipe(
          retry(this.maxRetries),
          map((r) => r.data),
        ),
    );

    const items = Array.isArray(res?.items) ? (res.items as ZohoItem[]) : [];
    if (items.length === 0) {
      throw new Error(
        `ZohoBooksApiService.getItemBySku - No item found for sku: ${sku}`,
      );
    }

    // Assuming SKU is unique in Zoho Books
    return items[0];
  }
  /**
   * Fetch full item details by item_id to retrieve fields like tax_id.
   * Uses the internal rate limiter to avoid overwhelming Zoho API.
   */
  public async findItemDetailsByID(itemId: string): Promise<ZohoItem> {
    const url = `${this.ZOHO_BOOK_API}/items/${encodeURIComponent(
      itemId,
    )}?organization_id=${this.ORGANIZATION_ID}`;
    347732000051243498;
    const data = await firstValueFrom(
      this.httpService
        .get(url, {
          headers: {
            Authorization: `Zoho-oauthtoken ${await this.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        })
        .pipe(
          retry(this.maxRetries),
          map((r) => r.data),
        ),
    );

    const item = data?.item;
    if (!item) {
      throw new Error(
        `ZohoBooksApiService.findItemDetailsByID - No item details for id: ${itemId}`,
      );
    }
    return item as ZohoItem;
  }

  /**
   * Search a contact in Zoho by email.
   * Returns: { contactExists, contactId } or apiError.
   */
  async searchContactByEmail(email: string): Promise<SearchZohoContactResult> {
    if (!email?.trim()) {
      return {
        apiError: false,
        contactExists: false,
      };
    }

    const url = `${this.contactsUrl()}&status=active&email_startswith=${encodeURIComponent(email.trim())}`;

    try {
      const res = await firstValueFrom(
        this.httpService
          .get(url, {
            headers: {
              Authorization: `Zoho-oauthtoken ${await this.getAccessToken()}`,
              'Content-Type': 'application/json',
            },
          })
          .pipe(
            retry(this.maxRetries),
            map((r) => r.data),
          ),
      );

      const contacts = Array.isArray(res?.contacts)
        ? (res.contacts as ZohoContact[])
        : [];

      if (contacts.length === 0) {
        return { apiError: false, contactExists: false };
      }
      if (contacts.length === 1) {
        return {
          apiError: false,
          contactExists: true,
          contactId: contacts[0].contact_id,
        };
      }

      // Many contacts found with same email: pick the first deterministically
      // (Keep it simple now; later you can implement address comparison)
      return {
        apiError: false,
        contactExists: true,
        contactId: contacts[0].contact_id,
      };
    } catch (error: any) {
      this.logger.error(
        'Zoho searchContactByEmail failed',
        error?.response?.data || error?.message,
      );
      return {
        apiError: true,
        contactExists: false,
        errorMessage:
          typeof error?.response?.data === 'string'
            ? error.response.data
            : error?.message || 'Unknown Zoho API error',
      };
    }
  }

  /**
   * Create a Zoho contact (customer)
   */
  async createCustomer(params: CreateZohoCustomerParams): Promise<ZohoContact> {
    const payload = {
      ...params,
      contact_type: 'customer' as const,
      contact_persons: params.contact_persons ?? [],
      custom_fields: params.custom_fields ?? [],
      billing_address: params.billing_address ?? {},
      shipping_address: params.shipping_address ?? {},
    };

    try {
      const res = await firstValueFrom(
        this.httpService
          .post(this.contactsUrl(), JSON.stringify(payload), {
            headers: {
              Authorization: `Zoho-oauthtoken ${await this.getAccessToken()}`,
              'Content-Type': 'application/json',
            },
          })
          .pipe(
            retry(this.maxRetries),
            map((r) => r.data),
            catchError((error) => {
              throw new HttpException(
                `Zoho createCustomer failed: ${
                  typeof error?.response?.data === 'string'
                    ? error.response.data
                    : error?.message || 'Unknown error'
                }`,
                error?.response?.status || HttpStatus.BAD_GATEWAY,
              );
            }),
          ),
      );

      const contact = res?.contact as ZohoContact | undefined;
      if (!contact?.contact_id) {
        throw new HttpException(
          'Zoho createCustomer: missing contact_id in response',
          HttpStatus.BAD_GATEWAY,
        );
      }

      this.logger.log(`✅  Created Zoho contact: ${contact.contact_id}`);
      return contact;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        `Zoho createCustomer failed: ${error}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
  /**
   * Delete a Zoho contact (rollback)
   */
  async deleteCustomer(contactId: string): Promise<void> {
    if (!contactId?.trim()) return;
    try {
      await firstValueFrom(
        this.httpService
          .delete(this.contactByIdUrl(contactId), {
            headers: {
              Authorization: `Zoho-oauthtoken ${await this.getAccessToken()}`,
              'Content-Type': 'application/json',
            },
          })
          .pipe(
            retry(this.maxRetries),
            map((r) => r.data),
            catchError((error) => {
              throw new HttpException(
                `Zoho deleteCustomer failed: ${
                  typeof error?.response?.data === 'string'
                    ? error.response.data
                    : error?.message || 'Unknown error'
                }`,
                error?.response?.status || HttpStatus.BAD_GATEWAY,
              );
            }),
          ),
      );
      this.logger.log(`Rollback Zoho CONTACT: ${contactId}`);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        `Zoho deleteCustomer failed: ${error}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async createSalesOrder(
    orderData: ZohoBooksSalesOrderRequest,
  ): Promise<ZohoBooksSalesOrderResponse> {
    try {
      this.logger.debug(`🛠️   Creating sales order in Zoho Books`);

      const response = await firstValueFrom(
        this.httpService
          .post(`${this.ZOHO_BOOK_API}/salesorders`, orderData, {
            params: { organization_id: this.ORGANIZATION_ID },
            headers: {
              Authorization: `Zoho-oauthtoken ${await this.getAccessToken()}`,
              'Content-Type': 'application/json',
            },
          })
          .pipe(
            catchError((error) => {
              this.logger.error('Failed to create Zoho sales order', {
                error: error.response?.data || error.message,
                status: error.response?.status,
              });
              throw error;
            }),
          ),
      );

      this.logger.log(
        `✅ Sales order created successfully: ${response.data.salesorder?.salesorder_number}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error creating Zoho sales order:', error);
      throw error;
    }
  }
  /**
   * Mark a sales order as confirmed.
   * POST /salesorders/{salesorder_id}/status/confirm
   */
  public async markSaleOrderAsConfirmed(salesorderId: string): Promise<{
    code: number;
    message: string;
  }> {
    try {
      const url = `${this.ZOHO_BOOK_API}/salesorders/${salesorderId}/status/confirmed`;

      const response = await firstValueFrom(
        this.httpService
          .post(
            url,
            {},
            {
              params: { organization_id: this.ORGANIZATION_ID },
              headers: {
                Authorization: `Zoho-oauthtoken ${await this.getAccessToken()}`,
                'Content-Type': 'application/json',
              },
            },
          )
          .pipe(
            catchError((error) => {
              this.logger.error('Failed to confirm Zoho sales order', {
                salesorderId,
                error: error.response?.data || error.message,
                status: error.response?.status,
              });
              throw error;
            }),
          ),
      );

      this.logger.log(`✅  Sales order confirmed: ${salesorderId}`);
      return response.data as ZohoBooksSalesOrderResponse;
    } catch (error) {
      this.logger.error('Error confirming Zoho sales order:', {
        salesorderId,
        error,
      });
      throw error;
    }
  }

  /**
   * Mark a sales order as approved.
   * POST /salesorders/{salesorder_id}/status/approve
   */
  public async markSaleOrderAsApproved(salesorderId: string): Promise<{
    code: number;
    message: string;
  }> {
    try {
      const url = `${this.ZOHO_BOOK_API}/salesorders/${salesorderId}/approve`;

      const response = await firstValueFrom(
        this.httpService
          .post(
            url,
            {},
            {
              params: { organization_id: this.ORGANIZATION_ID },
              headers: {
                Authorization: `Zoho-oauthtoken ${await this.getAccessToken()}`,
                'Content-Type': 'application/json',
              },
            },
          )
          .pipe(
            catchError((error) => {
              this.logger.error('Failed to approve Zoho sales order', {
                salesorderId,
                error: error.response?.data || error.message,
                status: error.response?.status,
              });
              throw error;
            }),
          ),
      );

      this.logger.log(`✅  Sales order approved: ${salesorderId}`);
      return response.data as ZohoBooksSalesOrderResponse;
    } catch (error) {
      this.logger.error('Error approving Zoho sales order:', {
        salesorderId,
        error,
      });
      throw error;
    }
  }

  /**
   * Mark a sales order as tobesipped.
   * POST /salesorders/{salesorder_id}/status/approve
   */
  public async markSaleOrderAsToBeShipped(salesorderId: string): Promise<{
    code: number;
    message: string;
  }> {
    try {
      const url = `${this.ZOHO_BOOK_API}/salesorders/${salesorderId}/substatus/cs_tobeshi`;

      const response = await firstValueFrom(
        this.httpService
          .post(
            url,
            {},
            {
              params: { organization_id: this.ORGANIZATION_ID },
              headers: {
                Authorization: `Zoho-oauthtoken ${await this.getAccessToken()}`,
                'Content-Type': 'application/json',
              },
            },
          )
          .pipe(
            catchError((error) => {
              this.logger.error('Failed to approve Zoho sales order', {
                salesorderId,
                error: error.response?.data || error.message,
                status: error.response?.status,
              });
              throw error;
            }),
          ),
      );

      this.logger.log(`✅  Sales order maked as tobe shipped: ${salesorderId}`);
      return response.data as ZohoBooksSalesOrderResponse;
    } catch (error) {
      this.logger.error('Error approving Zoho sales order:', {
        salesorderId,
        error,
      });
      throw error;
    }
  }

  async getItem(itemId: string): Promise<ZohoBookItem | undefined> {
    const url = `${this.ZOHO_BOOK_API}/items/${itemId}`;
    const accessToken = await this.getAccessToken();
    const response = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        'X-com-zoho-organizationid': this.ORGANIZATION_ID,
      },
    });
    if (!response.ok) {
      const result = await response.text();
      throw new Error(`Failed to get item: ${result}`);
    }
    const { item } = (await response.json()) as ZohoBookItemResponse;
    return item;
  }

  public async fetchZohoWarehouseStocks(
    items: ZohoBookItem[],
  ): Promise<{ item_id: string; sku: string; warehouseStock: number }[]> {
    const marginalAndFunctionalItems = this.keepOnlyMarginalAndFunctionalItems(
      items.map((item) => ({
        item_id: item.item_id,
        sku: item.sku,
      })),
    );

    const stockPromises = marginalAndFunctionalItems.map((item) =>
      this.getItemWarehouseStockFromZoho(item),
    );

    return Promise.all(stockPromises);
  }

  private keepOnlyMarginalAndFunctionalItems(
    zohoBookItems: { item_id: string; sku: string }[],
  ) {
    return zohoBookItems.filter((item) => item.sku.endsWith('/M/1'));
  }

  private async getItemWarehouseStockFromZoho(item: {
    item_id: string;
    sku: string;
  }): Promise<{ item_id: string; sku: string; warehouseStock: number }> {
    const itemDetails = await this.getItemDetails(item.item_id);
    const warehouseStock = this.calculateTotalAvailableStock(
      itemDetails.warehouses,
    );

    return {
      item_id: item.item_id,
      sku: item.sku,
      warehouseStock,
    };
  }

  private calculateTotalAvailableStock(warehouses: Warehouse[]) {
    return warehouses.reduce((reducedWarehouseStock, warehouse) => {
      if (warehouse.warehouse_id === this.GMBH_WAREHOUSE_ID) {
        reducedWarehouseStock +=
          warehouse.warehouse_actual_available_for_sale_stock;
      }
      return reducedWarehouseStock;
    }, 0);
  }

  public async fetchZohoItemsForSkuStartingWith(
    skuPrefix: string,
    currentPage: number = 1,
  ): Promise<ZohoBookItem[]> {
    const url = `${this.ZOHO_BOOK_API}/items`;
    const urlParams = new URLSearchParams();
    urlParams.append('organization_id', this.ORGANIZATION_ID);
    urlParams.append('page', currentPage.toString());
    urlParams.append('per_page', '200');
    urlParams.append('filter_by', 'Status.Active');
    urlParams.append('sku_startswith', skuPrefix);
    const urlWithParams = `${url}?${urlParams.toString()}`;

    const response = await this.scheduledFetch(urlWithParams);

    const data = (await response.json()) as ZohoBookItemsResponse;

    if (!response.ok) {
      throw new Error(
        `Failed to get items: ${data.message || 'Unknown error'}`,
      );
    }
    const items = data.items;
    const hasMorePage = data.page_context.has_more_page;

    return [
      ...items,
      ...(hasMorePage
        ? await this.fetchZohoItemsForSkuStartingWith(
            skuPrefix,
            currentPage + 1,
          )
        : []),
    ];
  }

  private async getItemDetails(item_id: string) {
    const url = `${this.ZOHO_BOOK_API}/items/${item_id}`;
    const urlParams = new URLSearchParams();
    urlParams.append('organization_id', this.ORGANIZATION_ID);
    const urlWithParams = `${url}?${urlParams.toString()}`;

    const response = await this.scheduledFetch(urlWithParams);

    const data = (await response.json()) as ZohoBookItemResponse;
    if (!response.ok) {
      throw new Error(
        `Failed to get item details: ${data.message || 'Unknown error'}`,
      );
    }
    if (!data.item) {
      throw new Error(`Item not found: ${item_id}`);
    }
    return data.item;
  }

  private async scheduledFetch(
    url: string,
    method: string = 'GET',
    body?: any,
    customHeaders?: Record<string, string>,
  ): Promise<Response> {
    const accessToken = await this.getAccessToken();
    const headers = {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
      'X-com-zoho-organizationid': this.ORGANIZATION_ID,
      ...customHeaders,
    };

    return this.limiter.schedule(() =>
      fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
  }
}
