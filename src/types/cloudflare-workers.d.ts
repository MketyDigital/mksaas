declare module 'cloudflare:workers' {
  export function waitUntil(promise: Promise<unknown>): void;
  export const env: {
    MKETY_DB?: {
      connectionString: string;
    };
    AI?: {
      run(
        model: string,
        input: Record<string, unknown>,
        options?: {
          gateway?: { id: string; skipCache?: boolean; cacheTtl?: number };
          rejectIfBusy?: boolean;
        },
      ): Promise<unknown>;
    };
  } & Record<string, unknown>;
}
