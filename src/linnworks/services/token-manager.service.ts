import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { catchError, firstValueFrom, retry } from 'rxjs';

export interface LinnworksAuthResponse {
  CustomerId: number;
  FullName: string;
  Company: string;
  ProductName: string;
  ExpirationDate: string;
  IsAccountHolder: boolean;
  SessionUserId: number;
  IsAutoTestSession: boolean;
  Id: string;
  EntityId: string;
  DatabaseName: string;
  TTL: number;
  Token: string;
  AccessToken: string | null;
  GroupName: string;
  Device: string;
  DeviceType: string;
  UserType: string;
  UserId: string;
  Email: string;
  Server: string;
  PushServer: string;
  Status: {
    State: string;
    Reason: string;
    Parameters: Record<string, any>;
  };
  Properties: Record<string, any>;
}

@Injectable()
export class TokenManagerService {
  private readonly logger = new Logger(TokenManagerService.name);
  private readonly REDIS_TOKEN_KEY = 'linnworks:auth:token';
  private readonly REDIS_AUTH_DATA_KEY = 'linnworks:auth:data';
  private readonly TOKEN_REFRESH_BUFFER = 300; // Refresh 5 minutes before expiry

  private refreshPromise: Promise<string> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getValidToken(): Promise<string> {
    try {
      // Check if we have a valid token in Redis
      const cachedToken = await this.redis.get(this.REDIS_TOKEN_KEY);

      if (cachedToken) {
        const ttl = await this.redis.ttl(this.REDIS_TOKEN_KEY);

        // If token expires in less than 5 minutes, refresh it
        if (ttl > this.TOKEN_REFRESH_BUFFER) {
          this.logger.debug(`♻️ Using cached token, expires in ${ttl} seconds`);
          return cachedToken;
        }

        this.logger.debug(`🔄 Token expires soon (${ttl}s), refreshing...`);
      }

      // Ensure only one refresh happens at a time
      if (this.refreshPromise) {
        this.logger.debug('🔂 Token refresh already in progress, waiting...');
        return await this.refreshPromise;
      }

      this.refreshPromise = this.refreshToken();
      const newToken = await this.refreshPromise;
      this.refreshPromise = null;

      return newToken;
    } catch (error) {
      this.refreshPromise = null;
      this.logger.error('⛑️ Failed to get valid token:', error);
      throw error;
    }
  }

  private async refreshToken(): Promise<string> {
    try {
      this.logger.log('🛠️ Refreshing Linnworks token...');

      // Use the global auth endpoint for authorization
      const authApiUrl =
        this.configService.get<string>('linnworks.authApiUrl') ||
        'https://api.linnworks.net/api';

      const applicationId = this.configService.get<string>(
        'linnworks.applicationId',
      );
      const applicationSecret = this.configService.get<string>(
        'linnworks.applicationSecret',
      );
      const installationToken = this.configService.get<string>(
        'linnworks.installationToken',
      );

      if (!applicationId || !applicationSecret || !installationToken) {
        throw new Error('⛑️ Missing Linnworks authentication credentials');
      }

      const payload = {
        applicationId,
        applicationSecret,
        token: installationToken,
      };

      const response = await firstValueFrom(
        this.httpService
          .post(`${authApiUrl}/Auth/AuthorizeByApplication`, payload, {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          })
          .pipe(
            retry(2),
            catchError((error) => {
              this.logger.error(
                '⛑️ Token refresh API call failed:',
                error.response?.data || error.message,
              );
              throw error;
            }),
          ),
      );

      const authData: LinnworksAuthResponse = response.data;

      if (!authData.Token) {
        throw new Error('⛑️ No token received from Linnworks API');
      }

      // Store token in Redis with TTL minus buffer time
      const tokenTTL = Math.max(authData.TTL - this.TOKEN_REFRESH_BUFFER, 60);
      await this.redis.setex(this.REDIS_TOKEN_KEY, tokenTTL, authData.Token);

      // Store full auth data for potential future use
      await this.redis.setex(
        this.REDIS_AUTH_DATA_KEY,
        tokenTTL,
        JSON.stringify(authData),
      );

      this.logger.log(
        `✅ Token refreshed successfully, expires in ${authData.TTL} seconds`,
      );

      return authData.Token;
    } catch (error) {
      this.logger.error('Failed to refresh token:', error);
      throw error;
    }
  }

  async getAuthData(): Promise<LinnworksAuthResponse | null> {
    try {
      const cachedData = await this.redis.get(this.REDIS_AUTH_DATA_KEY);
      return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
      this.logger.error('❌ Failed to get auth data:', error);
      return null;
    }
  }

  async clearTokenCache(): Promise<void> {
    await Promise.all([
      this.redis.del(this.REDIS_TOKEN_KEY),
      this.redis.del(this.REDIS_AUTH_DATA_KEY),
    ]);
    this.logger.log('🧹  Token cache cleared');
  }

  async getTokenStatus(): Promise<{
    hasToken: boolean;
    expiresIn: number;
    authData: LinnworksAuthResponse | null;
  }> {
    const hasToken = await this.redis.exists(this.REDIS_TOKEN_KEY);
    const expiresIn = hasToken ? await this.redis.ttl(this.REDIS_TOKEN_KEY) : 0;
    const authData = await this.getAuthData();

    return {
      hasToken: Boolean(hasToken),
      expiresIn,
      authData,
    };
  }
}
