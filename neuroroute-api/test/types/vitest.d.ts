declare module 'vitest' {
  // Re-export Jest types for compatibility
  export interface MockInstance<T extends (...args: any[]) => any> {
    new (...args: any[]): any;
    (...args: Parameters<T>): ReturnType<T>;
    mockClear(): this;
    mockReset(): this;
    mockRestore(): void;
    mockImplementation(fn: (...args: Parameters<T>) => ReturnType<T>): this;
    mockImplementationOnce(fn: (...args: Parameters<T>) => ReturnType<T>): this;
    mockName(name: string): this;
    getMockName(): string;
    mock: {
      calls: Parameters<T>[];
      instances: any[];
      invocationCallOrder: number[];
      results: { type: 'return' | 'throw'; value: any }[];
    };
    mockReturnValue(value: ReturnType<T>): this;
    mockReturnValueOnce(value: ReturnType<T>): this;
    mockResolvedValue<U extends ReturnType<T>>(value: U extends Promise<infer V> ? V : never): this;
    mockResolvedValueOnce<U extends ReturnType<T>>(value: U extends Promise<infer V> ? V : never): this;
    mockRejectedValue(value: any): this;
    mockRejectedValueOnce(value: any): this;
  }

  export type Mock<T extends (...args: any[]) => any> = MockInstance<T> & T;

  export function fn<T extends (...args: any[]) => any>(implementation?: T): Mock<T>;
  
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>, timeout?: number): void;
  export function test(name: string, fn: () => void | Promise<void>, timeout?: number): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  
  export function expect<T>(actual: T): {
    toBe(expected: T): void;
    toEqual(expected: any): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeNull(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThan(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toBeInstanceOf(expected: any): void;
    toContain(expected: any): void;
    toHaveProperty(property: string, value?: any): void;
    toHaveLength(expected: number): void;
    toMatch(expected: string | RegExp): void;
    toMatchObject(expected: object): void;
    toThrow(expected?: string | Error | RegExp): void;
    toThrowError(expected?: string | Error | RegExp): void;
    not: any;
    resolves: any;
    rejects: any;
    [key: string]: any;
  };
  
  export const vi: {
    fn: typeof fn;
    mock: (path: string, factory?: () => any) => void;
    clearAllMocks: () => void;
    resetAllMocks: () => void;
    restoreAllMocks: () => void;
    spyOn: (object: any, method: string) => MockInstance<any>;
    [key: string]: any;
  };
}