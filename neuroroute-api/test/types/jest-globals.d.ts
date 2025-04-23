/**
 * Jest Globals Type Definitions
 * 
 * This file provides type definitions for Jest globals to be used in test files.
 */

import type { jest as JestType } from '@jest/globals';

declare global {
  const jest: typeof JestType;
  const describe: (name: string, fn: () => void) => void;
  const it: (name: string, fn: (...args: any[]) => any, timeout?: number) => void;
  const test: (name: string, fn: (...args: any[]) => any, timeout?: number) => void;
  const expect: any;
  const beforeAll: (fn: () => any, timeout?: number) => void;
  const beforeEach: (fn: () => any, timeout?: number) => void;
  const afterAll: (fn: () => any, timeout?: number) => void;
  const afterEach: (fn: () => any, timeout?: number) => void;
}