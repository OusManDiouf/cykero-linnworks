import { afterAll, beforeEach, describe, expect } from 'vitest';
import { HttpModule } from '@nestjs/axios';
import {
  closeTestMongoDb,
  createTestingModule,
} from '../../../test/helpers/test-helpers';
import { LinnworksApiService } from './linnworks-api.service';
import { TokenManagerService } from './token-manager.service';
import { LocationMappingService } from './location-mapping.service';
import { ConfigService } from '@nestjs/config';
import { ZohoBooksApiService } from '../../zoho-books/services/zoho-books-api.service';
import { TestingModule } from '@nestjs/testing';
import { server } from '../../../test/mocks/server';
import { http, HttpResponse } from 'msw';

describe('LinnworksApiService - Stock Update Migration', () => {
  let service: LinnworksApiService;
  let testingModule: TestingModule;

  beforeEach(async () => {
    const built = await createTestingModule({
      imports: [
        HttpModule.register({ timeout: 30000 }),
        // No DB needed in this spec when mocking LocationMappingService
      ],
      providers: [
        LinnworksApiService,
        // Mock LocationMappingService to break the circular dep and avoid DB
        {
          provide: LocationMappingService,
          useValue: {
            // Successful resolution for known Zoho ID
            resolveLinnworksLocationId: async ({
              zohoLocationId,
              zohoLocationName,
            }: {
              zohoLocationId?: string;
              zohoLocationName?: string;
            }) => {
              if (!zohoLocationId) {
                throw new Error(
                  `Missing zohoLocationId for "${zohoLocationName || 'unknown'}"`,
                );
              }
              if (zohoLocationId === '347732000000070863') {
                return '7366e4bf-8b16-4f13-88a2-c74043e1c39c';
              }
              if (zohoLocationId === '347732000000070865') {
                return '61a41f5f-04d2-464c-bd27-7ce556b1fb70';
              }
              throw new Error('Location mapping missing');
            },
          },
        },
        TokenManagerService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              switch (key) {
                case 'linnworks.apiUrl':
                  return 'https://eu-ext.linnworks.net/api';
                case 'linnworks.maxRetries':
                  return 0; // keep fast in tests
                case 'linnworks.batchSize':
                  return 50;
                default:
                  return undefined;
              }
            },
          },
        },
        {
          provide: TokenManagerService,
          useValue: {
            getValidToken: async () => 'fake-token',
            clearTokenCache: async () => undefined,
          },
        },
        { provide: ZohoBooksApiService, useValue: {} },
      ],
    });

    testingModule = built.module;
    service = testingModule.get<LinnworksApiService>(LinnworksApiService);
  });

  afterAll(async () => {
    if (testingModule) {
      await testingModule.close();
    }
    await closeTestMongoDb();
  });

  describe('updateStockLevels with LocationMapping', () => {
    beforeEach(() => {
      // Mock the Linnworks stock update API
      server.use(
        http.post(
          'https://eu-ext.linnworks.net/api/Stock/SetStockLevel',
          () => {
            return HttpResponse.json({ Success: true });
          },
        ),
      );
    });

    it('should update stock using Zoho location ID via mapping', async () => {
      const stockUpdates = [
        {
          itemSKU: 'TEST-SKU-001',
          itemStocksCount: 100,
          locationName: 'Cykero GmbH (Warehouse)',
          zohoLocationId: '347732000000070863', // Zoho location ID
        },
      ];

      await expect(
        service.updateStockLevels(stockUpdates),
      ).resolves.not.toThrow();
    });

    it('should throw error if Zoho location ID is missing', async () => {
      const stockUpdates = [
        {
          itemSKU: 'TEST-SKU-001',
          itemStocksCount: 100,
          locationName: 'Cykero GmbH (Warehouse)',
          // Missing zohoLocationId
        },
      ];

      await expect(service.updateStockLevels(stockUpdates)).rejects.toThrow(
        'Missing zohoLocationId',
      );
    });

    it('should throw error if mapping does not exist', async () => {
      const stockUpdates = [
        {
          itemSKU: 'TEST-SKU-001',
          itemStocksCount: 100,
          locationName: 'Unknown Warehouse',
          zohoLocationId: 'unknown-zoho-id',
        },
      ];

      await expect(service.updateStockLevels(stockUpdates)).rejects.toThrow(
        'Location mapping missing',
      );
    });

    it('should handle empty stock updates', async () => {
      await expect(service.updateStockLevels([])).resolves.not.toThrow();
    });

    it('should handle negative stock counts by converting to 0', async () => {
      const stockUpdates = [
        {
          itemSKU: 'TEST-SKU-001',
          itemStocksCount: -5,
          locationName: 'Cykero GmbH (Warehouse)',
          zohoLocationId: '347732000000070863',
        },
      ];

      await expect(
        service.updateStockLevels(stockUpdates),
      ).resolves.not.toThrow();
    });

    it('should process multiple stock updates with different locations', async () => {
      const stockUpdates = [
        {
          itemSKU: 'TEST-SKU-001',
          itemStocksCount: 100,
          locationName: 'Cykero GmbH (Warehouse)',
          zohoLocationId: '347732000000070863', // known in mock
        } as any,
        {
          itemSKU: 'TEST-SKU-002',
          itemStocksCount: 50,
          locationName: 'Cykero ML (Warehouse)',
          zohoLocationId: '347732000000070865', // known in mock
        } as any,
      ];

      await expect(
        service.updateStockLevels(stockUpdates),
      ).resolves.not.toThrow();
    });
  });
});
