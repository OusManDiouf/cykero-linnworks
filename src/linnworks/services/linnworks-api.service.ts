import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, map, retry } from 'rxjs';

export interface GetOrdersRequest {
  entriesPerPage?: number;
  pageNumber?: number;
  fromDate?: string;
  toDate?: string;
  loadItems?: boolean;
  loadAdditionalInfo?: boolean;
  ordersIds?: string[];
}

@Injectable()
export class LinnworksApiService {
  private readonly logger = new Logger(LinnworksApiService.name);
  private readonly apiUrl: string;
  private readonly maxRetries: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiUrl = this.configService.get<string>('linnworks.apiUrl') as string;
    this.maxRetries = this.configService.get<number>(
      'linnworks.maxRetries',
    ) as number;
  }

  private getHeaders(): Record<string, string> {
    const token = this.configService.get<string>('linnworks.token') as string;
    return {
      Authorization: token,
      'Content-Type': 'application/json; charset=UTF-8',
      Accept: 'application/json',
    };
  }

  async getOrders(params: GetOrdersRequest = {}): Promise<any[]> {
    try {
      const defaultParams = {
        loadItems: true,
        loadAdditionalInfo: true,
        entriesPerPage: this.configService.get<number>('linnworks.batchSize'),
        pageNumber: 1,
        ...params,
      };

      const formData = new URLSearchParams();
      Object.entries(defaultParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, value.toString());
          }
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const response = await firstValueFrom(
        this.httpService
          .post(`${this.apiUrl}/Orders/GetOrders`, formData.toString(), {
            headers: this.getHeaders(),
          })
          .pipe(
            retry(this.maxRetries),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            map((response) => response.data),
            catchError((error) => {
              this.logger.error(
                `API Error:`,
                error.response?.data || error.message,
              );
              throw new HttpException(
                `Linnworks API error: ${error.message}`,
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
              );
            }),
          ),
      );

      return response || [];
    } catch (error) {
      this.logger.error('Failed to fetch orders:', error);
      throw error;
    }
  }
}
