/** @jest-environment node */

const mockClient = Object.assign(jest.fn(), { end: jest.fn() });
const mockPostgres = jest.fn(() => mockClient);
const mockDatabase = { singleton: true };
const mockDrizzle = jest.fn(() => mockDatabase);
const mockRuntimeConnectionString = jest.fn<() => string>();

jest.mock('postgres', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockPostgres(...args),
}));

jest.mock('drizzle-orm/postgres-js', () => ({
  drizzle: (...args: unknown[]) => mockDrizzle(...args),
}));

jest.mock('./runtime-connection', () => ({
  getRuntimeDatabaseConnectionString: () => mockRuntimeConnectionString(),
}));

describe('database singleton runtime connection', () => {
  beforeEach(() => {
    jest.resetModules();
    mockPostgres.mockClear();
    mockDrizzle.mockClear();
    mockRuntimeConnectionString.mockReset();
    delete process.env.SKIP_ENV_VALIDATION;
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    delete process.env.SKIP_ENV_VALIDATION;
    delete process.env.DATABASE_URL;
  });

  it('creates the singleton from the runtime database connection resolver', async () => {
    mockRuntimeConnectionString.mockReturnValue('postgresql://runtime.example/mkety');

    const module = await import('./index');

    expect(module.db).toBe(mockDatabase);
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
