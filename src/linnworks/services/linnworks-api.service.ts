import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, map, retry } from 'rxjs';
import { TokenManagerService } from './token-manager.service';

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

  async getOpenOrders(params: GetOpenOrdersRequest = {}): Promise<{
    ResultCountRemovedByPostFilter: number;
    PageNumber: number;
    EntriesPerPage: number;
    TotalEntries: number;
    TotalPages: number;
    Data: any[];
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

  async getOrders(params: GetOrdersRequest = {}): Promise<any[]> {
    return this.makeApiCall(async (headers) => {
      const payload = {
        loadItems: true,
        loadAdditionalInfo: true,
        entriesPerPage: this.configService.get<number>('linnworks.batchSize'),
        pageNumber: 1,
        ordersIds: params.ordersIds || [],
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const response = await firstValueFrom(
        this.httpService
          .post(`${this.apiUrl}/Orders/GetOrders`, payload, {
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
