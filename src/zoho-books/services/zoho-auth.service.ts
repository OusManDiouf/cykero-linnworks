import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

export interface ZohoRefreshTokenResponse {
  access_token: string;
  scope: string;
  api_domain: string;
  token_type: string;
  expires_in: number;
  error?: string;
}
@Injectable()
export class ZohoAuthService {
  private readonly TOKEN_KEY: string;
  private readonly REFRESH_TOKEN_URI: string;
  private readonly REFRESH_TOKEN: string;
  private readonly CLIENT_ID: string;
  private readonly CLIENT_SECRET: string;
  private readonly GRANT_TYPE: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    if (!this.configService.get('REDIS_ZOHO_TOKEN_KEY')) {
      throw new Error('REDIS_ZOHO_TOKEN_KEY is not set');
    }
    if (!this.configService.get('ZOHO_BOOK_API_REFRESH_TOKEN_URI')) {
      throw new Error('ZOHO_BOOK_API_REFRESH_TOKEN_URI is not set');
    }
    if (!this.configService.get('ZOHO_BOOK_API_REFRESH_TOKEN')) {
      throw new Error('ZOHO_BOOK_API_REFRESH_TOKEN is not set');
    }

    if (!this.configService.get('ZOHO_BOOK_API_CLIENT_ID')) {
      throw new Error('ZOHO_BOOK_API_CLIENT_ID is not set');
    }
    if (!this.configService.get('ZOHO_BOOK_API_CLIENT_SECRET')) {
      throw new Error('ZOHO_BOOK_API_CLIENT_SECRET is not set');
    }
    if (!this.configService.get('ZOHO_BOOK_API_REFRESH_TOKEN')) {
      throw new Error('ZOHO_BOOK_API_REFRESH_TOKEN is not set');
    }
    if (!this.configService.get('ZOHO_BOOK_API_GRANT_TYPE')) {
      throw new Error('ZOHO_BOOK_API_GRANT_TYPE is not set');
    }

    // ============================================================
    this.TOKEN_KEY = this.configService.get('REDIS_ZOHO_TOKEN_KEY') as string;
    this.REFRESH_TOKEN_URI = this.configService.get(
      'ZOHO_BOOK_API_REFRESH_TOKEN_URI',
    ) as string;

    this.REFRESH_TOKEN = this.configService.get(
      'ZOHO_BOOK_API_REFRESH_TOKEN',
    ) as string;

    this.CLIENT_ID = this.configService.get(
      'ZOHO_BOOK_API_CLIENT_ID',
    ) as string;

    this.CLIENT_ID = this.configService.get(
      'ZOHO_BOOK_API_CLIENT_ID',
    ) as string;

    this.CLIENT_SECRET = this.configService.get(
      'ZOHO_BOOK_API_CLIENT_SECRET',
    ) as string;

    this.GRANT_TYPE = this.configService.get(
      'ZOHO_BOOK_API_GRANT_TYPE',
    ) as string;
  }

  async getAccessToken(): Promise<string> {
    const cachedToken = await this.redisService.get(this.TOKEN_KEY);
    if (cachedToken) {
      return cachedToken;
    }

    // refresh
    const token = await this.refreshAccessToken();
    await this.redisService.set(this.TOKEN_KEY, token);
    return token;
  }

  private async refreshAccessToken(): Promise<string> {
    const response = await fetch(this.REFRESH_TOKEN_URI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: this.REFRESH_TOKEN,
        client_id: this.CLIENT_ID,
        client_secret: this.CLIENT_SECRET,
        grant_type: this.GRANT_TYPE,
      }),
    });

    const result = (await response.json()) as ZohoRefreshTokenResponse;
    if (!response.ok || result.error) {
      throw new Error(
        `Failed to refresh Zoho access token: ${JSON.stringify(result)}`,
      );
    }

    return result.access_token;
  }
}
