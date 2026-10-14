export function formatArchiveChunkFailure(input: {
  fileName: string;
  chunkIndex: number;
  chunkCount: number;
  status?: number;
  rayId?: string | null;
}) {
  const location = `${input.fileName}, piece ${input.chunkIndex + 1} of ${input.chunkCount}`;
  if (!input.status) return `Upload lost its connection at ${location} before the server replied.`;

  const ray = input.rayId ? `; Cloudflare Ray ID ${input.rayId}` : '';
  return `Upload stopped at ${location} (HTTP ${input.status}${ray}).`;
}

const ARCHIVE_FINALIZE_ERRORS: Record<string, string> = {
  files: 'The server could not assemble the uploaded pieces or validate the archive.',
  type: 'Choose EML, MBOX or ZIP files.',
  size: 'One or more files exceed the allowed size.',
  mailbox: 'The selected destination mailbox could not be validated.',
  workspace: 'The Mail workspace could not be validated.',
  active: 'An archive import is already running. Wait for it to finish before starting another.',
  archive_queue_unavailable: 'The archive was validated, but the background import queue is unavailable.',
};

export function formatArchiveCompleteFailure(input: { status: number; rayId?: string | null; errorCode?: string }) {
  const message = input.errorCode ? ARCHIVE_FINALIZE_ERRORS[input.errorCode] : undefined;
  const code = message && input.errorCode ? ` (${input.errorCode})` : '';
  const ray = input.rayId ? `; Cloudflare Ray ID ${input.rayId}` : '';
  const description = message || 'Archive finalization failed';
  return `${description}${code} (HTTP ${input.status}${ray}).`;
}
