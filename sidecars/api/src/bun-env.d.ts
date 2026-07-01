declare module "bun:test" {
  type MatcherResult = void;
  interface Matchers<T> {
    toBe(expected: unknown): MatcherResult;
    toEqual(expected: unknown): MatcherResult;
    toBeInstanceOf(expected: unknown): MatcherResult;
    toThrow(expected?: unknown): MatcherResult;
    toContain(expected: unknown): MatcherResult;
    toMatchObject(expected: unknown): MatcherResult;
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
  export function afterEach(fn: () => void | Promise<void>): void;
  export function expect<T>(actual: T): ExpectInstance<T>;
}

declare module "node:fs/promises" {
  export function mkdtemp(prefix: string): Promise<string>;
  export function readFile(path: string, encoding: "utf8"): Promise<string>;
  export function rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  export function stat(path: string): Promise<{ size: number }>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function writeFile(path: string, data: string, encoding?: "utf8"): Promise<void>;
  export function appendFile(path: string, data: string, encoding?: "utf8"): Promise<void>;
}

declare module "node:fs" {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function writeFileSync(path: string, data: string, encoding?: "utf8"): void;
}

declare module "node:path" {
  export function join(...parts: string[]): string;
  export function dirname(path: string): string;
}

declare module "node:os" {
  export function tmpdir(): string;
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
