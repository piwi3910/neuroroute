// Type definitions for Jest mocked Prisma client

import { PrismaClient } from '@prisma/client';

// Add Jest mock methods to any function
interface MockedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T>;
  mockReturnValue: (value: ReturnType<T>) => MockedFunction<T>;
  mockResolvedValue: (value: Awaited<ReturnType<T>>) => MockedFunction<T>;
  mockRejectedValue: (error: any) => MockedFunction<T>;
  mockImplementation: (fn: (...args: Parameters<T>) => ReturnType<T>) => MockedFunction<T>;
  mockClear: () => MockedFunction<T>;
  mockReset: () => MockedFunction<T>;
}

// Create a recursive type that adds Jest mock methods to all functions in an object
type DeepMockProxy<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => infer R
    ? MockedFunction<T[K]>
    : T[K] extends object
    ? DeepMockProxy<T[K]>
    : T[K];
};

// Extend the Prisma module
declare module '@prisma/client' {
  // Make all Prisma client methods mockable
  type MockablePrismaClient = {
    [K in keyof PrismaClient]: PrismaClient[K] extends (...args: any[]) => any
      ? MockedFunction<PrismaClient[K]>
      : PrismaClient[K] extends object
      ? DeepMockProxy<PrismaClient[K]>
      : PrismaClient[K];
  };
}

// Export the mocked PrismaClient type
export type MockedPrismaClient = DeepMockProxy<PrismaClient>;