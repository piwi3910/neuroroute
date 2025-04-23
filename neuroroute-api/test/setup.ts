// Jest setup file
import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.PORT = '3001';
process.env.HOST = 'localhost';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/neuroroute_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
// @ts-ignore
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Clean up after all tests
afterAll(async () => {
  // Add any cleanup logic here
});