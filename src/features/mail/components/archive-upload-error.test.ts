import { formatArchiveChunkFailure, formatArchiveCompleteFailure } from './archive-upload-error';

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

describe('formatArchiveCompleteFailure', () => {
  it('explains safe finalization error codes and includes HTTP and Cloudflare diagnostics', () => {
    expect(
      formatArchiveCompleteFailure({
        status: 400,
        rayId: 'def456',
        errorCode: 'files',
      }),
    ).toBe(
      'The server could not assemble the uploaded pieces or validate the archive. (files) (HTTP 400; Cloudflare Ray ID def456).',
    );
  });

  it('does not show unexpected response text in the error message', () => {
    expect(
      formatArchiveCompleteFailure({
        status: 500,
        rayId: null,
        errorCode: 'database-password-leak',
      }),
    ).toBe('Archive finalization failed (HTTP 500).');
  });

  it('does not treat inherited object properties as allowlisted error codes', () => {
    expect(
      formatArchiveCompleteFailure({
        status: 500,
        errorCode: '__proto__',
      }),
    ).toBe('Archive finalization failed (HTTP 500).');
  });
});
