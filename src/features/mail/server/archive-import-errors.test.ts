import { safeArchiveMessageErrorCode } from './archive-import-errors';

describe('safeArchiveMessageErrorCode', () => {
  it('preserves safe parser codes', () => {
    expect(safeArchiveMessageErrorCode(new Error('source_message_invalid_mime'))).toBe('source_message_invalid_mime');
    expect(safeArchiveMessageErrorCode(new Error('source_message_missing_sender'))).toBe('source_message_missing_sender');
  });

  it('classifies missing and rejected Mail content storage without exposing raw errors', () => {
    expect(safeArchiveMessageErrorCode(new Error('Mkety Mail content storage is not configured.'))).toBe(
      'mail_content_storage_unconfigured',
    );
    expect(safeArchiveMessageErrorCode(new Error('Mkety Mail content storage rejected the migration object.'))).toBe(
      'mail_content_storage_rejected',
    );
  });

  it('never persists arbitrary database, provider, or personal error text', () => {
    expect(safeArchiveMessageErrorCode(new Error('sensitive@example.com: database constraint failed'))).toBe(
      'archive_message_import_failed',
    );
    expect(safeArchiveMessageErrorCode('not an Error')).toBe('archive_message_import_failed');
  });
});
