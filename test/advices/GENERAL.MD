### README — Unit-testing NestJS services with deep dependencies (Mongo, Redis, HTTP)
**Scope**
- Keep mocks local to each test or reset them in beforeEach if you later add tests that rely on mock call history.
    1. Fresh mocks per test
        ```ts
        it('does X', async () => {
          const linnworksApi = { getStockLocations: vi.fn().mockResolvedValue([]) };
          // inject/use linnworksApi here
        });
        ```
     2. Shared mocks, reset before each test
        ```ts
        import { vi, beforeEach } from 'vitest';
        
        const linnworksApi = {
          getStockLocations: vi.fn(),
          setStockLevels: vi.fn(),
        };
        
        beforeEach(() => {
          vi.clearAllMocks();         // resets all vi.fn() call history
          vi.resetModules();          // optional: reset module cache if you re-import
          // Or be granular:
          linnworksApi.getStockLocations.mockReset().mockResolvedValue([]);
          linnworksApi.setStockLevels.mockReset();
        });
        
        // use linnworksApi in your providers
        ```
Useful Vitest APIs
- vi.fn(): create a mock function.
- mockReset(): clear calls, instances, and mock implementation.
- mockClear(): clear only calls and instances (keeps implementation).
- mockRestore(): restore original implementation for spied functions.
- vi.clearAllMocks(): clear calls for all mocks.
- vi.resetAllMocks(): reset calls and implementations for all mocks.
- vi.restoreAllMocks(): restore all spies to original.

Choosing between them
- If implementations differ per test, set them in the test body or in beforeEach via mockImplementationOnce/mockResolvedValueOnce.
- If implementations are the same across tests, set a default in beforeEach and just clear call history with mockClear.
- If your tests rely on fresh module singletons (e.g., re-reading env), use vi.resetModules() and re-import within tests.
- Unit-test a service that uses Mongoose models and other services with external concerns (Redis, HTTP, config).
- Keep tests isolated, fast, and deterministic.

----

**Principles**

- Test the unit, not the world: stub downstream services (HTTP, Redis, token/auth services, external SDKs).
- Use in-memory Mongo for model-level behavior (mongodb-memory-server).
- Avoid wiring infrastructure modules (Redis, schedulers, full feature modules) in unit tests.

**Setup checklist**

- Build a TestingModule with only what the unit needs:
  - MongooseModule.forFeature for the model(s) in this test.
  - The service under test as a provider.
  - Stubs for all other injected services the SUT requires.
- Example stubs:
  - LinnworksApiService: { getStockLocations: async () => [] }
  - ZohoBooksApiService: { /* add methods as needed */ }
- Avoid deep dependencies:
  - Do not import Redis modules or provide real Token/Zoho auth services in unit tests.
  - If some provider still resolves @InjectRedis, supply a no-op mock for default_IORedisModuleConnectionToken.
- Config:
  - Prefer not to touch ConfigService at all. If a constructed class requires it, stub that class instead.
  - If you must provide config, expose only the keys used and return typed values.
- TestingModule typing and teardown:
  - Keep a typed TestingModule reference and call testingModule.close() in afterAll.
  - Close in-memory Mongo after tests.

**Patterns to copy**

- Minimal test module
    ``` ts
    const built = await createTestingModule({
    imports: [
        HttpModule.register({ timeout: 30000 }),
        MongooseModule.forFeature([{ name: LocationMapping.name, schema: LocationMappingSchema }]),
    ],
    providers: [
        LocationMappingService,
  
        // stubs:
        { provide: LinnworksApiService, useValue: { getStockLocations: vi.fn().mockResolvedValue([]) } },
        { provide: ZohoBooksApiService, useValue: {} },
  
        // only if something still tries to resolve Redis:
        // { provide: 'default_IORedisModuleConnectionToken', useValue: mockRedis }
    ],
    });
    const testingModule = built.module;
    const service = testingModule.get(LocationMappingService);
    ```
    
- Teardown
    ``` ts
    afterAll(async () => {
      await testingModule.close();
      await closeTestMongoDb();
    });
    ```

- Mocks hygiene
    ``` ts
    beforeEach(() => {
        vi.clearAllMocks(); // if you share mock objects across tests
    });
    ```

**What to avoid**

- Importing feature modules (they pull in real providers and infra).
- Constructing services that require real Redis/HTTP/config unless explicitly stubbing their internals.
- Returning any from config/mocks; prefer typed keys and values to keep ESLint quiet.

**When to go beyond unit tests**

- For integration behavior (real Redis, real HTTP), use:
    - Testcontainers for Redis.
    - MSW or nock for HTTP.
    - Keep these as separate, slower test suites.

With this approach, adding “so many Services” downstream is manageable: stub at the boundary, 
keep the test module slim, and only add the minimal methods your test needs.