declare module "bun:test" {
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void): void;
  export function afterEach(fn: () => void): void;
  export interface ExpectBase {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThan(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toContain(expected: unknown): void;
    toBeCloseTo(expected: number, precision?: number): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeInstanceOf(expected: unknown): void;
    toMatch(expected: string | RegExp): void;
    toThrow(expected?: unknown): void;
    toHaveLength(expected: number): void;
  }
  export interface ExpectWithNot extends ExpectBase {
    readonly not: Pick<ExpectBase, "toBe" | "toEqual" | "toBeNull" | "toBeUndefined" | "toContain" | "toMatch" | "toThrow">;
  }
  export interface ExpectHelpers {
    arrayContaining(expected: readonly unknown[]): unknown;
    objectContaining(expected: Record<string, unknown>): unknown;
    closeTo(expected: number, precision?: number): unknown;
    any(constructor: unknown): unknown;
    anything(): unknown;
  }
  export type ExpectFn = ((actual: unknown) => ExpectWithNot) & ExpectHelpers;
  export const expect: ExpectFn;
}
