declare module "bun:test" {
  type MatcherResult = void;
  interface Matchers<T> {
    toBe(expected: unknown): MatcherResult;
    toEqual(expected: unknown): MatcherResult;
    toBeInstanceOf(expected: unknown): MatcherResult;
    toThrow(expected?: unknown): MatcherResult;
    toContain(expected: unknown): MatcherResult;
    toBeLessThanOrEqual(expected: number): MatcherResult;
    toBeGreaterThan(expected: number): MatcherResult;
    toBeDefined(): MatcherResult;
  }
  interface ExpectNot<T> extends Matchers<T> {
    [key: string]: (expected: unknown) => MatcherResult;
  }
  interface ExpectInstance<T> extends Matchers<T> {
    readonly not: ExpectNot<T>;
  }
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect<T>(actual: T): ExpectInstance<T>;
}

interface ImportMeta {
  main: boolean;
}

declare const process: {
  env: Record<string, string | undefined>;
};

declare const Bun: {
  serve(options: {
    hostname?: string;
    port?: number;
    fetch?: (request: Request) => Response | Promise<Response>;
  }): {
    hostname: string;
    port: number;
  };
};