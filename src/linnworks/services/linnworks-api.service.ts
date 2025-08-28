import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, map, retry } from 'rxjs';
import { TokenManagerService } from './token-manager.service';
import { OrderDto } from '../dto/order.dto';
import {
  LinnworksStockLevelUpdate,
  StockUpdateItem,
} from '../../zoho-books/types/zoho-books-types';

export interface DateFieldFilter {
  FieldCode?: string;
  Type: 'Range' | 'SingleDate';
  DateFrom?: string;
  DateTo?: string;
  Value?: number;
}

export interface GetOpenOrdersFilters {
  DateFields?: DateFieldFilter[];
  ListFields?: Array<{
    FieldCode: string;
    Type: number;
    Value: number;
  }>;
  TextFields?: Array<{
    FieldCode: string;
    Type: number;
    Text: string;
  }>;
  BooleanFields?: any[];
  NumericFields?: any[];
}

export interface GetOrdersRequest {
  entriesPerPage?: number;
  pageNumber?: number;
  fromDate?: string;
  toDate?: string;
  loadItems?: boolean;
  loadAdditionalInfo?: boolean;
  ordersIds?: string[];
}

export interface GetOpenOrdersRequest {
  entriesPerPage?: number;
  pageNumber?: number;
  filters?: GetOpenOrdersFilters;
  sorting?: Array<{
    FieldCode?: string;
    Direction: number;
  }>;
  fulfilmentCenter?: string;
  additionalFilter?: string;
}

export interface PollingStrategy {
  name: 'incremental' | 'id-based' | 'fallback';
  reason: string;
  estimatedApiCalls: number;
}

export interface GetAllOpenOrdersFilter {
  fulfilmentCenter?: string; // Location UUID
  additionalFilter?: string; // Optional additional filter
  exactMatch?: boolean; // Whether to use exact match for additionalFilter
}

export interface GetOpenOrdersDetailsRequest {
  // List of order ids as unique identifiers (uuids)
  OrderIds: string[];
  // (optional) List of detail level limiters. If null/empty, full details are returned
  DetailLevel?: string[];
}

// Request type for Orders/SetOrderShippingInfo
export interface SetOrderShippingInfoRequest {
  orderId: string; // uuid
  info: {
    PostalServiceId?: string; // uuid
    TotalWeight?: number; // double
    ItemWeight?: number; // double
    PostageCost?: number; // double
    TrackingNumber?: string; // string
    ManualAdjust?: boolean; // boolean
  };
}

// Request/response types for Orders/ProcessOrder
export interface ProcessOrderRequest {
  orderId: string; // uuid
  scanPerformed: boolean; // optional, defaults false by API if omitted
  locationId: string; // uuid (user location)
  context?: {
    Module?: string;
  };
}

export interface ProcessOrderResponse {
  OrderId: string;
  Processed: boolean;
}

@Injectable()
export class LinnworksApiService {
  private readonly logger = new Logger(LinnworksApiService.name);
  private readonly apiUrl: string;
  private readonly maxRetries: number;
  private readonly batchSize: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly tokenManager: TokenManagerService,
  ) {
    this.apiUrl = this.configService.get<string>('linnworks.apiUrl') as string;
    this.maxRetries = this.configService.get<number>(
      'linnworks.maxRetries',
    ) as number;
    this.batchSize = this.configService.get<number>(
      'linnworks.batchSize',
    ) as number;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.tokenManager.getValidToken();
    return {
      Authorization: token,
      'Content-Type': 'application/json; charset=UTF-8',
      Accept: 'application/json',
    };
  }

  /**
   * Update stock levels in Linnworks for multiple items
   */
  async updateStockLevels(stockUpdates: StockUpdateItem[]): Promise<void> {
    if (stockUpdates.length === 0) {
      this.logger.debug('No stock updates to process');
      return;
    }

    try {
      // Resolve all locations at once, then map by name (case-insensitive)
      const locations = await this.getStockLocations();
      const nameToId = new Map<string, string>(
        locations.map((l) => [l.LocationName.toLowerCase(), l.StockLocationId]),
      );

      // Convert to Linnworks format with the correct LocationId per item
      const stockLevels: LinnworksStockLevelUpdate[] = stockUpdates.map(
        (item) => {
          const key = (item.warehouseName || '').toLowerCase();
          const locationId = nameToId.get(key);

          if (!locationId) {
            throw new Error(
              `Warehouse "${item.warehouseName}" not found in Linnworks locations`,
            );
          }

          return {
            SKU: item.itemSKU,
            LocationId: locationId,
            Level: Math.max(0, item.itemStocksCount), // Clamp negative levels to 0
          };
        },
      );

      await this.setStockLevels(stockLevels);

      this.logger.log(
        `✅  Successfully updated stock levels for ${stockUpdates.length} items`,
      );
    } catch (error) {
      this.logger.error('Failed to update stock levels in Linnworks:', error);
      throw error;
    }
  }

  /**
   * Set stock levels using Linnworks API
   */
  private async setStockLevels(
    stockLevels: LinnworksStockLevelUpdate[],
  ): Promise<any> {
    return this.makeApiCall(async (headers) => {
      const response = await firstValueFrom(
        this.httpService
          .post(
            `${this.apiUrl}/Stock/SetStockLevel`,
            { stockLevels },
            { headers },
          )
          .pipe(
            retry(this.maxRetries),
            map((response) => response.data),
            catchError((error) => {
              const data = error.response?.data ?? error.message;
              this.logger.error(
                'Linnworks Stock API Error:',
                typeof data === 'string' ? data : JSON.stringify(data),
              );
              throw error;
            }),
          ),
      );
      return response;
    });
  }

  /**
   * Update stock level for a single item by SKU
   */
  async updateSingleItemStock(
    sku: string,
    stockLevel: number,
    warehouseName: string,
  ): Promise<void> {
    await this.updateStockLevels([
      {
        itemSKU: sku,
        itemStocksCount: stockLevel,
        warehouseName,
      },
    ]);
  }

  /**
   * Fetch all stock locations from Linnworks Inventory/GetStockLocations
   */
  public async getStockLocations(): Promise<
    {
      StockLocationId: string;
      LocationName: string;
    }[]
  > {
    return this.makeApiCall(async (headers) => {
      const response = await firstValueFrom(
        this.httpService
          .get(`${this.apiUrl}/Inventory/GetStockLocations`, { headers })
          .pipe(
            retry(this.maxRetries),
            map((res) => {
              const data = res.data;
              return Array.isArray(data) ? data : [];
            }),
            catchError((error) => {
              const data = error.response?.data ?? error.message;
              this.logger.error(
                'API Error:',
                typeof data === 'string' ? data : JSON.stringify(data),
              );
              throw new HttpException(
                `Linnworks API error: ${error.message}`,
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
              );
            }),
          ),
      );
      return response;
    });
  }

  /**
   * Get all open order IDs (no pagination limit)
   */
  public async getAllOpenOrderIds(): Promise<string[]> {
    return this.makeApiCall(async (headers) => {
      const payload = {
        fulfilmentCenter: '00000000-0000-0000-0000-000000000000',
      };

      const response = await firstValueFrom(
        this.httpService
          .post(`${this.apiUrl}/Orders/GetAllOpenOrders`, payload, {
            headers,
          })
          .pipe(
            retry(this.maxRetries),
            map((response) => response.data),
            catchError((error) => {
              const data = error.response?.data ?? error.message;
              this.logger.error(
                'API Error:',
                typeof data === 'string' ? data : JSON.stringify(data),
              );
              throw new HttpException(
                `Linnworks API error: ${error.message}`,
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
              );
            }),
          ),
      );

      return Array.isArray(response) ? response : [];
    });
  }
  /**
   * Retrieves details for open orders by their order IDs. Supports efficient batching and is not limited by the number of orders.
   * @param {GetOpenOrdersDetailsRequest} request - The request object containing order IDs and optional detail level
   * @param {string[]} request.OrderIds - List of order IDs as unique identifiers (UUIDs)
   * @param {string[]} [request.DetailLevel] - Optional list of detail level limiters. If null/empty, full details are returned
   * @returns {Promise<OrderDto[]>} List of order details
   */
  async getOpenOrderDetailsByIds(
    request: GetOpenOrdersDetailsRequest,
  ): Promise<OrderDto[]> {
    if (!request?.OrderIds || request.OrderIds.length === 0) {
      return [];
    }

    // Process in batches to avoid API limits while using the tested endpoint
    const batchSize = Math.max(1, this.batchSize || 50);
    const batches: string[][] = [];
    for (let i = 0; i < request.OrderIds.length; i += batchSize) {
      batches.push(request.OrderIds.slice(i, i + batchSize));
    }

    this.logger.debug(
      `ℹ️  Fetching open order details for ${request.OrderIds.length} IDs in ${batches.length} batches`,
    );

    const allOrders: OrderDto[] = [];

    const extractOrderArray = (u: unknown): OrderDto[] => {
      if (Array.isArray(u)) {
        return u as OrderDto[];
      }
      if (u && typeof u === 'object') {
        const obj = u as Record<string, unknown>;
        const fromOrders = obj['Orders'];
        const fromData = obj['Data'];
        if (Array.isArray(fromOrders)) return fromOrders as OrderDto[];
        if (Array.isArray(fromData)) return fromData as OrderDto[];
      }
      return [];
    };

    for (const batch of batches) {
      try {
        const orders = await this.makeApiCall(async (headers) => {
          const payload: Record<string, unknown> = {
            OrderIds: batch,
          };
          if (request.DetailLevel && request.DetailLevel.length > 0) {
            payload.DetailLevel = request.DetailLevel;
          }

          const result = await firstValueFrom(
            this.httpService
              .post(`${this.apiUrl}/OpenOrders/GetOpenOrdersDetails`, payload, {
                headers,
              })
              .pipe(
                retry(this.maxRetries),
                map((res: { data: unknown }) => extractOrderArray(res?.data)),
                catchError((error) => {
                  const data = error.response?.data ?? error.message;
                  this.logger.error(
                    'API Error:',
                    typeof data === 'string' ? data : JSON.stringify(data),
                  );
                  throw new HttpException(
                    `Linnworks API error: ${error.message}`,
                    error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
                  );
                }),
              ),
          );

          return result;
        });

        allOrders.push(...orders);

        // Small delay between batches to be API-friendly
        if (batches.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        this.logger.error(
          `❌ Failed to fetch batch of ${batch.length} orders:`,
          error,
        );
        // Continue with other batches rather than failing completely
      }
    }

    return allOrders;
  }

  // ===========================================================================
  /**
   * INTELLIGENT POLLING: Automatically chooses the best strategy
   */
  async getRecentOpenOrders(
    fromDate: Date,
    processedOrderIds: Set<string>,
  ): Promise<{
    orders: any[];
    strategy: PollingStrategy;
    totalOpenOrderIds?: string[];
  }> {
    const timeSinceLastPoll = Date.now() - fromDate.getTime();
    const hoursAgo = timeSinceLastPoll / (1000 * 60 * 60);

    // Strategy selection logic
    let strategy: PollingStrategy;

    // Recent polling but no history = Use incremental strategy
    strategy = {
      name: 'incremental',
      reason: 'Recent polling window - date filtering is efficient',
      estimatedApiCalls: 1,
    };

    this.logger.debug(`Using ${strategy.name} strategy: ${strategy.reason}`);

    try {
      let totalOpenOrderIds: string[] | undefined;
      const orders = await this.getOpenOrdersIncremental(fromDate);

      return { orders, strategy, totalOpenOrderIds };
    } catch (error) {
      this.logger.error(
        `${strategy.name} strategy failed, trying fallback:`,
        error,
      );

      // If chosen strategy fails, try fallback - NOT IMPLEMENTED YET

      throw error;
    }
  }

  /**
   * STRATEGY 1: Incremental Date-Based Polling (Most Efficient for Regular Load)
   * Uses the GetOpenOrders endpoint with DateFields filter
   */
  async getOpenOrdersIncremental(
    fromDate: Date,
    toDate?: Date,
  ): Promise<any[]> {
    const dateFilter: DateFieldFilter = {
      // FieldCode: 'GENERAL_INFO_RECEIVEDDATE', // Received date field
      Type: 'Range',
      DateFrom: fromDate.toISOString(),
      DateTo: (toDate || new Date()).toISOString(),
    };

    const request: GetOpenOrdersRequest = {
      entriesPerPage: this.batchSize,
      pageNumber: 1,
      filters: {
        DateFields: [dateFilter],
      },
      sorting: [
        {
          // FieldCode: 'GENERAL_INFO_RECEIVEDDATE',
          Direction: 1, // Ascending - oldest first
        },
      ],
      fulfilmentCenter: '00000000-0000-0000-0000-000000000000', // All locations
    };

    console.log(JSON.stringify(request, null, 2));

    return this.callGetOpenOrders(request);
  }

  /**
   * Call the advanced GetOpenOrders endpoint (with filtering support)
   */
  private async callGetOpenOrders(
    request: GetOpenOrdersRequest,
  ): Promise<any[]> {
    return this.makeApiCall(async (headers) => {
      const payload: GetOpenOrdersRequest = {
        entriesPerPage: request.entriesPerPage || this.batchSize,
        pageNumber: request.pageNumber || 1,
        filters: request.filters,
        sorting: request.sorting,
        fulfilmentCenter:
          request.fulfilmentCenter || '00000000-0000-0000-0000-000000000000',
        additionalFilter: request.additionalFilter || '',
      };

      const response = await firstValueFrom(
        this.httpService
          .post(`${this.apiUrl}/Orders/GetOpenOrders`, payload, {
            headers,
          })
          .pipe(
            retry(this.maxRetries),
            map((response) => response.data),
            catchError((error) => {
              const data = error.response?.data ?? error.message;
              this.logger.error(
                'API Error:',
                typeof data === 'string' ? data : JSON.stringify(data),
              );
              throw new HttpException(
                `Linnworks API error: ${error.message}`,
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
              );
            }),
          ),
      );

      return response || [];
    });
  }

  async processOrder(req: ProcessOrderRequest): Promise<ProcessOrderResponse> {
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

    if (!req?.orderId || !uuidRegex.test(req.orderId)) {
      throw new HttpException(
        'processOrder requires a valid orderId (UUID).',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!req.locationId) {
      throw new HttpException(
        'processOrder locationId must be provided.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Build payload with only defined fields
    const payload: Record<string, unknown> = {
      orderId: req.orderId,
    };
    if (typeof req.scanPerformed === 'boolean') {
      payload.scanPerformed = req.scanPerformed;
    }
    if (typeof req.locationId === 'string') {
      payload.locationId = req.locationId;
    }
    if (req.context && typeof req.context === 'object') {
      const ctx: Record<string, unknown> = {};
      if (typeof req.context.Module === 'string')
        ctx.Module = req.context.Module;
      if (Object.keys(ctx).length > 0) payload.context = ctx;
    }

    return this.makeApiCall(async (headers) => {
      return await firstValueFrom(
        this.httpService
          .post(`${this.apiUrl}/Orders/ProcessOrder`, payload, { headers })
          .pipe(
            retry(this.maxRetries),
            map((res) => res.data as ProcessOrderResponse),
            catchError((error) => {
              const data = error.response?.data ?? error.message;
              this.logger.error(
                'API Error:',
                typeof data === 'string' ? data : JSON.stringify(data),
              );
              throw new HttpException(
                `Linnworks API error: ${error.message}`,
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
              );
            }),
          ),
      );
    });
  }

  async setOrderShippingInfo(params: {
    orderId: string; // UUID
    info: { TrackingNumber: string };
  }): Promise<{ success: boolean }> {
    const { orderId, info } = params;

    if (!orderId) {
      throw new HttpException(
        '❌  setOrderShippingInfo requires a valid orderId (UUID).',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!info?.TrackingNumber?.trim()) {
      throw new HttpException(
        '❌  setOrderShippingInfo requires a non-empty TrackingNumber.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const payload = {
      info: { TrackingNumber: info.TrackingNumber.trim() },
      orderId,
    };

    return this.makeApiCall(async (headers) => {
      await firstValueFrom(
        this.httpService
          .post(`${this.apiUrl}/Orders/SetOrderShippingInfo`, payload, {
            headers,
          })
          .pipe(
            retry(this.maxRetries),
            map((res) => res.data),
            catchError((error) => {
              const data = error.response?.data ?? error.message;
              this.logger.error(
                'API Error:',
                typeof data === 'string' ? data : JSON.stringify(data),
              );
              throw new HttpException(
                `Linnworks API error: ${error.message}`,
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
              );
            }),
          ),
      );

      return { success: true };
    });
  }

  /**
   * Retrieves all open order IDs from Linnworks.
   *
   * @param {GetAllOpenOrdersFilter} [filter] - Optional filter criteria
   *   - `fulfilmentCenter` {string} - Location UUID. Defaults to '00000000-0000-0000-0000-000000000000'
   *   - `additionalFilter` {string} - Additional filter string. Defaults to empty string
   *   - `exactMatch` {boolean} - Whether to use exact match for additionalFilter. Defaults to false
   *
   * @return {Promise<string[]>} Array of order IDs. Empty array if no orders found.
   */
  async getAllOpenOrders(
    filter: GetAllOpenOrdersFilter = {},
  ): Promise<string[]> {
    return this.makeApiCall(async (headers) => {
      const payload = {
        fulfilmentCenter:
          filter.fulfilmentCenter ?? '00000000-0000-0000-0000-000000000000',
        additionalFilter: filter.additionalFilter ?? '',
        exactMatch: filter.exactMatch ?? false,
      };

      const response = await firstValueFrom(
        this.httpService
          .post(`${this.apiUrl}/Orders/GetAllOpenOrders`, payload, {
            headers,
          })
          .pipe(
            retry(this.maxRetries),
            map((res) => res.data as string[]),
            catchError((error) => {
              const data = error.response?.data ?? error.message;
              this.logger.error(
                'API Error:',
                typeof data === 'string' ? data : JSON.stringify(data),
              );
              throw new HttpException(
                `Linnworks API error: ${error.message}`,
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
              );
            }),
          ),
      );

      return Array.isArray(response) ? response : [];
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeApiCall(async (headers) => {
        return firstValueFrom(
          this.httpService.get(`${this.apiUrl}/Auth/GetServerUTCTime`, {
            headers,
          }),
        );
      });
      return true;
    } catch (error) {
      this.logger.error('Connection test failed:', error.message);
      return false;
    }
  }

  private async makeApiCall<T>(
    apiCall: (headers: Record<string, string>) => Promise<T>,
  ): Promise<T> {
    let lastError: any;

    // Try up to 2 times (original + 1 retry for token refresh)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const headers = await this.getHeaders();
        return await apiCall(headers);
      } catch (error) {
        lastError = error;

        // Check if it's a token-related error
        if (this.isTokenError(error) && attempt === 1) {
          this.logger.warn(
            'Token error detected, clearing cache and retrying...',
          );
          await this.tokenManager.clearTokenCache();
          continue; // Retry with a fresh token
        }

        // For non-token errors or final attempt, break
        break;
      }
    }

    this.handleApiError(lastError, 'API call');
  }

  private isTokenError(error: any): boolean {
    const errorMessage = error.response?.data?.Message || error.message || '';
    return (
      error.response?.status === 401 ||
      errorMessage.includes('Token is wrong') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('invalid token')
    );
  }

  private handleApiError(error: any, context: string): never {
    this.logger.error(
      `Linnworks API Error in ${context}:`,
      error.response?.data || error.message,
    );

    if (error.response?.status === 401) {
      throw new HttpException(
        'Linnworks API authentication failed',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (error.response?.status === 429) {
      throw new HttpException(
        'Linnworks API rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    throw new HttpException(
      `Linnworks API error: ${error.message}`,
      error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
