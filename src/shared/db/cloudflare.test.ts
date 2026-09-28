export {};

/** @jest-environment node */

const mockClient = Object.assign(jest.fn(), { end: jest.fn() });
const mockPostgres = jest.fn((_connectionString: string, _options: unknown) => mockClient);
const mockDatabase = {
  query: { marker: true },
  execute: jest.fn(),
};
const mockDrizzle = jest.fn((_client: unknown, _options: unknown) => mockDatabase);
const mockRuntimeConnectionString = jest.fn();

jest.mock('postgres', () => ({
  __esModule: true,
  default: (connectionString: string, options: unknown) => mockPostgres(connectionString, options),
}));

jest.mock('drizzle-orm/postgres-js', () => ({
  drizzle: (client: unknown, options: unknown) => mockDrizzle(client, options),
}));

jest.mock('./runtime-connection.cloudflare', () => ({
  getRuntimeDatabaseConnectionString: () => mockRuntimeConnectionString(),
}));

describe('Cloudflare database singleton lifecycle', () => {
  beforeEach(() => {
    jest.resetModules();
    mockPostgres.mockClear();
    mockDrizzle.mockClear();
    mockRuntimeConnectionString.mockReset();
    mockRuntimeConnectionString.mockReturnValue('postgresql://runtime.example/mkety');
    delete (globalThis as typeof globalThis & { cloudflareConn?: unknown }).cloudflareConn;
    delete (globalThis as typeof globalThis & { cloudflareDb?: unknown }).cloudflareDb;
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & { cloudflareConn?: unknown }).cloudflareConn;
    delete (globalThis as typeof globalThis & { cloudflareDb?: unknown }).cloudflareDb;
  });

  it('does not resolve Hyperdrive while the module is being imported', async () => {
    await import('./cloudflare');

    expect(mockRuntimeConnectionString).not.toHaveBeenCalled();
    expect(mockPostgres).not.toHaveBeenCalled();
    expect(mockDrizzle).not.toHaveBeenCalled();
  });

  it('uses the active request database context without creating the fallback singleton', async () => {
    const requestDatabase = {
      query: { requestScoped: true },
      execute: jest.fn(),
    };
    const { runWithRequestDatabaseContext } = await import('./request-context');
    const { db } = await import('./cloudflare');

    await runWithRequestDatabaseContext(requestDatabase, async () => {
      expect(db.query).toBe(requestDatabase.query);
      expect(typeof db.execute).toBe('function');
    });

    expect(mockRuntimeConnectionString).not.toHaveBeenCalled();
    expect(mockPostgres).not.toHaveBeenCalled();
    expect(mockDrizzle).not.toHaveBeenCalled();
  });

  it('initializes once on first database access and reuses the fallback singleton', async () => {
    const { db } = await import('./cloudflare');

    expect(mockRuntimeConnectionString).not.toHaveBeenCalled();

    expect(db.query).toBe(mockDatabase.query);
    expect(mockRuntimeConnectionString).toHaveBeenCalledTimes(1);
    expect(mockPostgres).toHaveBeenCalledWith('postgresql://runtime.example/mkety', {
      max: 1,
      prepare: false,
    });
    expect(mockDrizzle).toHaveBeenCalledTimes(1);

    expect(typeof db.execute).toBe('function');
    expect(mockRuntimeConnectionString).toHaveBeenCalledTimes(1);
    expect(mockPostgres).toHaveBeenCalledTimes(1);
    expect(mockDrizzle).toHaveBeenCalledTimes(1);
  });
});
