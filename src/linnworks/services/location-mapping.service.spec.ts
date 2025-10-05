import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MongooseModule } from '@nestjs/mongoose';
import {
  closeTestMongoDb,
  createTestingModule,
} from '../../../test/helpers/test-helpers';
import { LocationMappingService } from './location-mapping.service';
import { LinnworksApiService } from './linnworks-api.service';
import { ZohoBooksApiService } from '../../zoho-books/services/zoho-books-api.service';
import {
  LocationMapping,
  LocationMappingSchema,
} from '../schemas/location-mapping.schema';
import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TokenManagerService } from './token-manager.service';
import { HttpModule } from '@nestjs/axios'; // Remove hard dependencies by stubbing downstream services

const mockZohoBooksApi = {};

describe('LocationMappingService', () => {
  let service: LocationMappingService;
  let linnworksApi: LinnworksApiService;

  let testingModule: TestingModule;

  beforeEach(async () => {
    const built = await createTestingModule({
      imports: [
        // Keep HttpModule in imports
        HttpModule.register({ timeout: 30000 }),

        MongooseModule.forFeature([
          { name: LocationMapping.name, schema: LocationMappingSchema },
        ]),
      ],
      providers: [
        LocationMappingService,
        // User real LinnworksApiService (no overrides needed cuz MSW handles it)
        LinnworksApiService,

        // Minimal ConfigService stub for LinnworksApiService
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

        // Stub TokenManagerService to avoid Redis/auth
        {
          provide: TokenManagerService,
          useValue: {
            getValidToken: async () => 'fake-token',
            clearTokenCache: async () => undefined,
          },
        },
        // If your SUT also injects ZohoBooksApiService but you don’t need it here:
        { provide: ZohoBooksApiService, useValue: mockZohoBooksApi },
      ],
    });

    testingModule = built.module;
    service = testingModule.get<LocationMappingService>(LocationMappingService);
    linnworksApi = testingModule.get<LinnworksApiService>(LinnworksApiService);
  });

  afterAll(async () => {
    await testingModule.close();
    await closeTestMongoDb();
  });

  describe('getByZohoId', () => {
    it('should return null if mapping does not exist', async () => {
      const result = await service.getByZohoId('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return mapping if exists', async () => {
      const mapping = {
        zohoLocationId: '347732000000070863',
        zohoLocationName: 'Cykero GmbH (Warehouse)',
        linnworksLocationId: '7366e4bf-8b16-4f13-88a2-c74043e1c39c',
        linnworksLocationName: 'Cykero GmbH',
      };

      await service.upsert(mapping);

      const found = await service.getByZohoId(mapping.zohoLocationId);
      expect(found).toBeDefined();
      expect(found?.zohoLocationId).toBe(mapping.zohoLocationId);
    });
  });

  describe('upsert', () => {
    it('should create a new location mapping', async () => {
      const mapping = {
        zohoLocationId: '347732000000070863',
        zohoLocationName: 'Cykero GmbH (Warehouse)',
        linnworksLocationId: '7366e4bf-8b16-4f13-88a2-c74043e1c39c',
        linnworksLocationName: 'Cykero GmbH',
      };

      await service.upsert(mapping);

      const found = await service.getByZohoId(mapping.zohoLocationId);
      expect(found).toBeDefined();
      expect(found?.zohoLocationName).toBe(mapping.zohoLocationName);
      expect(found?.linnworksLocationId).toBe(mapping.linnworksLocationId);
    });

    it('should update existing location mapping', async () => {
      const mapping = {
        zohoLocationId: '347732000000070863',
        zohoLocationName: 'Cykero GmbH (Warehouse)',
        linnworksLocationId: '7366e4bf-8b16-4f13-88a2-c74043e1c39c',
        linnworksLocationName: 'Cykero GmbH',
      };

      // Create initial mapping
      await service.upsert(mapping);

      // Update with new Linnworks location
      const updatedMapping = {
        ...mapping,
        linnworksLocationId: 'new-linnworks-id',
        linnworksLocationName: 'Updated Location',
      };

      await service.upsert(updatedMapping);

      const found = await service.getByZohoId(mapping.zohoLocationId);
      expect(found?.linnworksLocationId).toBe('new-linnworks-id');
      expect(found?.linnworksLocationName).toBe('Updated Location');
    });
  });

  describe('resolveLinnworksLocationId', () => {
    it('should throw error if zohoLocationId is missing', async () => {
      await expect(
        service.resolveLinnworksLocationId({
          zohoLocationName: 'Test Location',
        }),
      ).rejects.toThrow('Missing zohoLocationId');
    });

    it('should return linnworksLocationId if mapping exists', async () => {
      const mapping = {
        zohoLocationId: '347732000000070863',
        zohoLocationName: 'Cykero GmbH (Warehouse)',
        linnworksLocationId: '7366e4bf-8b16-4f13-88a2-c74043e1c39c',
        linnworksLocationName: 'Cykero GmbH',
      };

      await service.upsert(mapping);

      const result = await service.resolveLinnworksLocationId({
        zohoLocationId: mapping.zohoLocationId,
        zohoLocationName: mapping.zohoLocationName,
      });

      expect(result).toBe(mapping.linnworksLocationId);
    });

    it('should throw error with suggestion if mapping does not exist', async () => {
      // This will call the mocked Linnworks API via MSW
      await expect(
        service.resolveLinnworksLocationId({
          zohoLocationId: '347732000000070863',
          zohoLocationName: 'Cykero GmbH (Warehouse)',
        }),
      ).rejects.toThrow('Location mapping missing');
    });
  });

  describe('name normalization and suggestion', () => {
    it('should suggest exact match after normalization', async () => {
      const mapping = {
        zohoLocationId: '347732000000070863',
        zohoLocationName: 'Cykero GmbH (Warehouse)',
        linnworksLocationId: '7366e4bf-8b16-4f13-88a2-c74043e1c39c',
        linnworksLocationName: 'Cykero GmbH',
      };

      await service.upsert(mapping);

      // Should work with normalized names
      const result = await service.resolveLinnworksLocationId({
        zohoLocationId: mapping.zohoLocationId,
        zohoLocationName: 'CYKERO GMBH (warehouse)',
      });

      expect(result).toBe(mapping.linnworksLocationId);
    });
  });

  describe('Integration with Linnworks API (via MSW)', () => {
    it('should fetch Linnworks locations via API', async () => {
      const locations = await linnworksApi.getStockLocations();

      expect(locations).toBeDefined();
      expect(Array.isArray(locations)).toBe(true);
      expect(locations.length).toBeGreaterThan(0);
      expect(locations[0]).toHaveProperty('StockLocationId');
      expect(locations[0]).toHaveProperty('LocationName');

      // Verify mock data
      const berlin = locations.find((l) => l.LocationName === 'Cykero GmbH');
      expect(berlin).toBeDefined();
      expect(berlin?.StockLocationId).toBe(
        '7366e4bf-8b16-4f13-88a2-c74043e1c39c',
      );
    });
  });
});
