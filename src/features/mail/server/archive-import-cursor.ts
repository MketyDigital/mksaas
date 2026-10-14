/** Narrow JSON cursor values before accessing archive-specific fields. */
export function getArchiveImportCursor(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function isLegacySynchronousArchiveCursor(value: unknown): boolean {
  const cursor = getArchiveImportCursor(value);
  return !cursor.packKey || !Array.isArray(cursor.messages);
}
