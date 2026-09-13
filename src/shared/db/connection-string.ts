export type DatabaseConnectionSources = {
  databaseUrl?: string | null;
  hyperdriveConnectionString?: string | null;
};

export function resolveDatabaseConnectionString({
  databaseUrl,
  hyperdriveConnectionString,
}: DatabaseConnectionSources): string {
  if (hyperdriveConnectionString) {
    return hyperdriveConnectionString;
  }

  if (databaseUrl) {
    return databaseUrl;
  }

  throw new Error('No database connection string is available');
}
