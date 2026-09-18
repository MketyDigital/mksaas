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

  it('initializes once on first database access and reuses the singleton', async () => {
    const { db } = await import('./cloudflare');

    expect(mockRuntimeConnectionString).not.toHaveBeenCalled();

    expect(db.query).toBe(mockDatabase.query);
    expect(mockRuntimeConnectionString).toHaveBeenCalledTimes(1);
    expect(mockPostgres).toHaveBeenCalledWith('postgresql://runtime.example/mkety', {
      max: undefined,
    });
    expect(mockDrizzle).toHaveBeenCalledTimes(1);

    expect(typeof db.execute).toBe('function');
    expect(mockRuntimeConnectionString).toHaveBeenCalledTimes(1);
    expect(mockPostgres).toHaveBeenCalledTimes(1);
    expect(mockDrizzle).toHaveBeenCalledTimes(1);
  });
});
