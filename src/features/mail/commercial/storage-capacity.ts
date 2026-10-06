export function isMailStorageWithinLimit(usedBytes: number, incomingBytes: number, maximumBytes: number | null) {
  if (!Number.isSafeInteger(usedBytes) || usedBytes < 0) return false;
  if (!Number.isSafeInteger(incomingBytes) || incomingBytes < 1) return false;
  if (maximumBytes === null) return true;
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) return false;
  return usedBytes + incomingBytes <= maximumBytes;
}
