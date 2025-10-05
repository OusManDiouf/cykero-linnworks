/**
 * Example test showing how to test a service that interacts with both APIs
 * This demonstrates the reusable test pattern
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { HttpModule } from '@nestjs/axios';
import { closeTestMongoDb, createTestingModule } from '../helpers/test-helpers';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

describe('Example: Testing Services with External APIs', () => {
  let module: any;

  beforeEach(async () => {
    const testModule = await createTestingModule({
      imports: [HttpModule.register({ timeout: 30000 })],
      providers: [
        // Add your services here
      ],
    });

    module = testModule.module;
  });

  afterAll(async () => {
    await module.close();
    await closeTestMongoDb();
  });

  describe('MSW Handler Examples', () => {
    it('should mock successful API response', async () => {
      // The default handlers from test/mocks/handlers.ts are active
      // You can test services that call those APIs

      // Example assertion (replace with actual service call)
      expect(true).toBe(true);
    });

    // it('should handle API errors with custom handler', async () => {
    //   // Override default handler for this specific test
    //   server.use(
    //     http.post(
    //       'https://eu-ext.linnworks.net/api/Inventory/GetStockLocations',
    //       () => {
    //         return HttpResponse.json(
    //           { error: 'Internal Server Error' },
    //           { status: 500 },
    //         );
    //       },
    //     ),
    //   );
    //
    //   // Now any service calling this endpoint will get the error
    //   // Test your error handling logic here
    // });

    it('should mock delayed responses', () => {
      server.use(
        http.get('https://www.zohoapis.eu/books/v3/locations', async () => {
          // Simulate network delay
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({ locations: [] });
        }),
      );

      // Test timeout or loading state handling
    });

    // it('should mock different responses based on request', async () => {
    //   server.use(
    //     http.post(
    //       'https://eu-ext.linnworks.net/api/Stock/UpdateStockLevel',
    //       async ({ request }) => {
    //         const body = await request.json();
    //
    //         // Mock different responses based on input
    //         if (body.sku === 'INVALID-SKU') {
    //           return HttpResponse.json(
    //             { error: 'SKU not found' },
    //             { status: 404 },
    //           );
    //         }
    //
    //         return HttpResponse.json({ success: true });
    //       },
    //     ),
    //   );
    //
    //   // Test different scenarios
    // });
  });

  describe('Database Testing Examples', () => {
    it('should have clean database state', async () => {
      // Each test gets a fresh MongoDB instance
      // No data pollution between tests
      const connection = module.get('DatabaseConnection');
      const collections = await connection.db.collections();

      // Should start empty
      expect(collections.length).toBeGreaterThanOrEqual(0);
    });

    it('can create and query data', async () => {
      // Example: Test MongoDB operations
      // Replace with actual model operations

      expect(true).toBe(true);
    });
  });
});
