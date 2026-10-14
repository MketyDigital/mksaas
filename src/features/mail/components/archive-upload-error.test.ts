import { formatArchiveChunkFailure } from './archive-upload-error';

describe('formatArchiveChunkFailure', () => {
  it('shows the failed file piece, HTTP status, and Cloudflare ray ID', () => {
    expect(
      formatArchiveChunkFailure({
        fileName: 'mkety-mail-archive-part-06.zip',
        chunkIndex: 0,
        chunkCount: 1,
        status: 500,
        rayId: 'abc123',
      }),
    ).toBe('Upload stopped at mkety-mail-archive-part-06.zip, piece 1 of 1 (HTTP 500; Cloudflare Ray ID abc123).');
  });
});
