import { getArchiveImportCursor, isLegacySynchronousArchiveCursor } from './archive-import-cursor';

describe('getArchiveImportCursor', () => {
  it.each([null, undefined, [], 'legacy', 42])('normalizes a non-object cursor (%p) to an empty object', (value) => {
    expect(getArchiveImportCursor(value)).toEqual({});
  });

  it('preserves a valid JSON object cursor', () => {
    const cursor = { packKey: 'mail/archive-staging/tenant/upload/message-pack', messages: [], nextMessageIndex: 0 };

    expect(getArchiveImportCursor(cursor)).toBe(cursor);
  });

  it.each([null, undefined, [], {}, { packKey: 'legacy-pack' }])(
    'recognizes a malformed or legacy cursor (%p)',
    (value) => {
      expect(isLegacySynchronousArchiveCursor(value)).toBe(true);
    },
  );

  it('recognizes the current archive cursor format', () => {
    expect(
      isLegacySynchronousArchiveCursor({
        packKey: 'mail/archive-staging/tenant/upload/message-pack',
        messages: [],
        nextMessageIndex: 0,
      }),
    ).toBe(false);
  });
});
