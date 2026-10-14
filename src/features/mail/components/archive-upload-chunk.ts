const MAX_CHUNK_ATTEMPTS = 3;

function isTransientStatus(status: number) {
  return status === 408 || status >= 500;
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Chunk writes are idempotent for the same upload and chunk coordinates, so a
 * lost response or transient server failure can safely retry the identical body.
 */
export async function postArchiveChunkWithRetry(
  send: () => Promise<Response>,
  pause: (milliseconds: number) => Promise<void> = wait,
) {
  for (let attempt = 0; attempt < MAX_CHUNK_ATTEMPTS; attempt += 1) {
    try {
      const response = await send();
      if (response.ok || !isTransientStatus(response.status) || attempt === MAX_CHUNK_ATTEMPTS - 1) {
        return response;
      }
    } catch (error) {
      if (attempt === MAX_CHUNK_ATTEMPTS - 1) throw error;
    }

    await pause(250 * 2 ** attempt);
  }

  throw new Error('Archive chunk upload attempts were exhausted.');
}
