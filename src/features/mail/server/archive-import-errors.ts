const SAFE_ARCHIVE_MESSAGE_ERROR_CODES = new Set([
  'source_message_size_limit',
  'source_message_invalid_mime',
  'source_message_missing_sender',
  'source_attachment_size_limit',
  'archive_message_limit',
  'archive_mbox_invalid',
  'archive_mbox_empty_message',
  'archive_path_invalid',
  'archive_format_unsupported',
  'archive_deflate_unsupported',
  'archive_expanded_size_limit',
  'archive_zip_invalid',
  'archive_entry_limit',
  'archive_encrypted_unsupported',
  'archive_compression_unsupported',
  'archive_checksum_invalid',
  'archive_size_limit',
  'archive_empty',
  'migration_run_unavailable',
]);

const SAFE_STORAGE_ERROR_CODES = new Map([
  ['Mkety Mail content storage is not configured.', 'mail_content_storage_unconfigured'],
  ['Mkety Mail content storage rejected the migration object.', 'mail_content_storage_rejected'],
  ['Mail content is outside the supported migration size.', 'mail_content_size_limit'],
]);

/** Returns a stable diagnostic code without persisting raw MIME, database, or provider errors. */
export function safeArchiveMessageErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return 'archive_message_import_failed';
  if (SAFE_ARCHIVE_MESSAGE_ERROR_CODES.has(error.message)) return error.message;
  return SAFE_STORAGE_ERROR_CODES.get(error.message) ?? 'archive_message_import_failed';
}
