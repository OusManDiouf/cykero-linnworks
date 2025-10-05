import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ConfigModule } from '@nestjs/config';

let mongod: MongoMemoryServer;

/**
 * Create an in-memory MongoDB instance for testing
 */
export async function createTestMongoDb() {
  mongod = await MongoMemoryServer.create();

  return mongod.getUri();
}

/**
 * Close and cleanup the in-memory MongoDB
 */
export async function closeTestMongoDb() {
  if (mongod) {
    await mongod.stop();
  }
}

/**
 * Create a testing module with MongoDB and ConfigModule
 */
export async function createTestingModule(config: {
  imports?: any[];
  providers?: any[];
  controllers?: any[];
}) {
  const mongoUri = await createTestMongoDb();

  const moduleBuilder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            MONGODB_URI: mongoUri,
            NODE_ENV: 'test',
          }),
        ],
      }),
      MongooseModule.forRoot(mongoUri),
      ...(config.imports || []),
    ],
    providers: config.providers || [],
    controllers: config.controllers || [],
  });

  const module: TestingModule = await moduleBuilder.compile();

  return { module, mongoUri };
}

/**
 * Clear all collections in the test database
 */
export async function clearDatabase(module: TestingModule) {
  const connection = module.get('DatabaseConnection');
  const collections = connection.connection.collections;

  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
