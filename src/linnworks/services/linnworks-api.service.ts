import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, map, retry } from 'rxjs';
import { TokenManagerService } from './token-manager.service';
import { OrderDto } from '../dto/order.dto';

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
  ViewId?: number;
  LocationId?: string;
  EntriesPerPage?: number;
  PageNumber?: number;
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

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly tokenManager: TokenManagerService,
  ) {
    this.apiUrl = this.configService.get<string>('linnworks.apiUrl') as string;
    this.maxRetries = this.configService.get<number>(
      'linnworks.maxRetries',
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

  async setOrderShippingInfo(
    req: SetOrderShippingInfoRequest,
  ): Promise<{ TotalsInfo?: any; ShippingInfo?: any }> {
    // Basic validation to avoid 400s
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    if (!req?.orderId || !uuidRegex.test(req.orderId)) {
      throw new HttpException(
        'setOrderShippingInfo requires a valid orderId (UUID).',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!req.info || typeof req.info !== 'object') {
      throw new HttpException(
        'setOrderShippingInfo requires an info object.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Build payload with only defined fields
    const info: Record<string, unknown> = {};
    if (req.info.PostalServiceId)
      info.PostalServiceId = req.info.PostalServiceId;
    if (typeof req.info.TotalWeight === 'number')
      info.TotalWeight = req.info.TotalWeight;
    if (typeof req.info.ItemWeight === 'number')
      info.ItemWeight = req.info.ItemWeight;
    if (typeof req.info.PostageCost === 'number')
      info.PostageCost = req.info.PostageCost;
    if (typeof req.info.TrackingNumber === 'string')
      info.TrackingNumber = req.info.TrackingNumber; // will be corrected below
    if (typeof req.info.ManualAdjust === 'boolean')
      info.ManualAdjust = req.info.ManualAdjust;

    // If no fields provided, fail fast
    if (Object.keys(info).length === 0) {
      throw new HttpException(
        'setOrderShippingInfo.info must include at least one field (e.g., TrackingNumber).',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.makeApiCall(async (headers) => {
      const payload = {
        orderId: req.orderId,
        info,
      };

      return await firstValueFrom(
        this.httpService
          .post(`${this.apiUrl}/Orders/SetOrderShippingInfo`, payload, {
            headers,
          })
          .pipe(
            retry(this.maxRetries),
            map((res) => res.data as { TotalsInfo?: any; ShippingInfo?: any }),
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

  /**
   * Retrieves details for open orders by their order IDs. This method is not limited by the number of orders.
   * @param {GetOpenOrdersDetailsRequest} request - The request object containing order IDs and optional detail level
   * @param {string[]} request.OrderIds - List of order IDs as unique identifiers (UUIDs)
   * @param {string[]} [request.DetailLevel] - Optional list of detail level limiters. If null/empty, full details are returned
   * @returns {Promise<OrderDto[]>} List of order details
   */
  async getOpenOrdersDetails(
    request: GetOpenOrdersDetailsRequest,
  ): Promise<OrderDto[]> {
    if (!request?.OrderIds || request.OrderIds.length === 0) {
      return [];
    }

    return this.makeApiCall(async (headers) => {
      const payload: Record<string, unknown> = {
        OrderIds: request.OrderIds,
      };
      if (request.DetailLevel && request.DetailLevel.length > 0) {
        payload.DetailLevel = request.DetailLevel;
      }

      const orders = await firstValueFrom(
        this.httpService
          .post(`${this.apiUrl}/OpenOrders/GetOpenOrdersDetails`, payload, {
            headers,
          })
          .pipe(
            retry(this.maxRetries),
            map((res) => {
              const data = res?.data as unknown;
              // API returns { Orders: [...] }. Fall back to Data or direct array if needed.
              const arr = (data as any)?.Orders ?? (data as any)?.Data ?? data;
              return Array.isArray(arr) ? (arr as OrderDto[]) : [];
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

      return orders;
    });
  }

  async getOpenOrders(params: GetOpenOrdersRequest = {}): Promise<{
    ResultCountRemovedByPostFilter: number;
    PageNumber: number;
    EntriesPerPage: number;
    TotalEntries: number;
    TotalPages: number;
    Data: OrderDto[];
  }> {
    return this.makeApiCall(async (headers) => {
      const payload = {
        ViewId: params.ViewId ?? 1,
        LocationId: params.LocationId ?? '00000000-0000-0000-0000-000000000000',
        EntriesPerPage:
          params.EntriesPerPage ??
          (this.configService.get<number>('linnworks.batchSize') as number),
        PageNumber: params.PageNumber ?? 1,
      };

      return await firstValueFrom(
        this.httpService
          .post(`${this.apiUrl}/OpenOrders/GetOpenOrders`, payload, {
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
