/** @jest-environment node */

const mockClient = Object.assign(jest.fn(), { end: jest.fn() });
const mockPostgres = jest.fn((_connectionString: string, _options: unknown) => mockClient);
const mockDatabase = { singleton: true };
const mockDrizzle = jest.fn((_client: unknown, _options: unknown) => mockDatabase);
const mockRuntimeConnectionString = jest.fn();

jest.mock('postgres', () => ({
  __esModule: true,
  default: (connectionString: string, options: unknown) => mockPostgres(connectionString, options),
}));

jest.mock('drizzle-orm/postgres-js', () => ({
  drizzle: (client: unknown, options: unknown) => mockDrizzle(client, options),
}));

jest.mock('./runtime-connection', () => ({
  getRuntimeDatabaseConnectionString: () => mockRuntimeConnectionString(),
}));

describe('database singleton runtime connection', () => {
  beforeEach(() => {
    jest.resetModules();
    delete (globalThis as typeof globalThis & { conn?: unknown }).conn;
    mockPostgres.mockClear();
    mockDrizzle.mockClear();
    mockRuntimeConnectionString.mockReset();
    delete process.env.SKIP_ENV_VALIDATION;
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & { conn?: unknown }).conn;
    delete process.env.SKIP_ENV_VALIDATION;
    delete process.env.DATABASE_URL;
  });

  it('creates the singleton from the runtime database connection resolver', async () => {
    mockRuntimeConnectionString.mockReturnValue('postgresql://runtime.example/mkety');

    const dbModule = await import('./index');

    expect(dbModule.db).toBe(mockDatabase);
    expect(mockRuntimeConnectionString).toHaveBeenCalledTimes(1);
    expect(mockPostgres).toHaveBeenCalledWith('postgresql://runtime.example/mkety', { max: undefined });
  });

  it('keeps a zero-connection build placeholder only when env validation is skipped', async () => {
    process.env.SKIP_ENV_VALIDATION = 'true';
    mockRuntimeConnectionString.mockImplementation(() => {
      throw new Error('No database connection string is available');
    });

    await expect(import('./index')).resolves.toBeDefined();
    expect(mockPostgres).toHaveBeenCalledWith('postgresql://localhost/placeholder', { max: 0 });
  });
});
