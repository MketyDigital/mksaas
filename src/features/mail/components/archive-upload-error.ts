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
