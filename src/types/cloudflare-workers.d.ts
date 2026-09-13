declare module 'cloudflare:workers' {
  export const env: {
    MKETY_DB?: {
      connectionString: string;
    };
  } & Record<string, unknown>;
}
