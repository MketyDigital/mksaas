import PostalMime from 'postal-mime';

const MAX_MESSAGE_BYTES = 25_000_000;
const MAX_HEADERS_SIZE = 1_000_000;
const MAX_BODY_CHARS = 2_000_000;
const MAX_ATTACHMENT_BYTES = 20_000_000;

export type ImportSourceMetadata = {
  folderPath: string;
  flags: string[];
  specialUse?: string[];
};

export type ParsedImportMessage = {
  raw: Uint8Array;
  folderPath: string;
  folder: 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'archive';
  isRead: boolean;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  messageId: string | null;
  occurredAt: Date | null;
  text: string;
  html: string;
  preview: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    content: Uint8Array;
  }>;
};

function addressStrings(value: unknown): string[] {
  const result: string[] = [];
  const visit = (item: unknown) => {
    if (!item || typeof item !== 'object') return;
    const record = item as Record<string, unknown>;
    if (typeof record.address === 'string' && record.address.trim()) {
      result.push(record.address.trim().toLowerCase().slice(0, 320));
    }
    if (Array.isArray(record.group)) record.group.forEach(visit);
  };
  if (Array.isArray(value)) value.forEach(visit);
  else visit(value);
  return [...new Set(result)].slice(0, 100);
}

function attachmentBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof value === 'string') return new TextEncoder().encode(value);
  return new Uint8Array();
}

function safeAttachmentFilename(value: unknown, index: number) {
  const raw = typeof value === 'string' ? value : `attachment-${index + 1}`;
  const normalized = raw
    .replace(/[\\/\0]/g, '_')
    .replace(/[^\p{L}\p{N}._()\- ]/gu, '_')
    .trim();
  return (normalized || `attachment-${index + 1}`).slice(0, 180);
}

function categoryForFolder(folderPath: string, specialUse: string[] = []): ParsedImportMessage['folder'] {
  const normalized = `${folderPath} ${specialUse.join(' ')}`.toLowerCase();
  if (normalized.includes('\\inbox') || /(^|[/. ])inbox([/. ]|$)/.test(normalized)) return 'inbox';
  if (normalized.includes('\\sent') || /sent|outbox/.test(normalized)) return 'sent';
  if (normalized.includes('\\drafts') || /draft/.test(normalized)) return 'drafts';
  if (normalized.includes('\\trash') || /trash|deleted items/.test(normalized)) return 'trash';
  if (normalized.includes('\\junk') || /spam|junk/.test(normalized)) return 'spam';
  return 'archive';
}

function previewText(text: string, html: string) {
  const source = text || html.replace(/<[^>]*>/g, ' ');
  return source.replace(/\s+/g, ' ').trim().slice(0, 240);
}

export async function fingerprintImportedMessage(raw: Uint8Array): Promise<string> {
  const copy = new Uint8Array(raw.byteLength);
  copy.set(raw);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', copy.buffer));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function parseMbox(raw: Uint8Array): Uint8Array[] {
  const isSeparator = (start: number, end: number) =>
    end - start >= 5 &&
    raw[start] === 0x46 &&
    raw[start + 1] === 0x72 &&
    raw[start + 2] === 0x6f &&
    raw[start + 3] === 0x6d &&
    raw[start + 4] === 0x20;
  const separators: number[] = [];
  let lineStart = 0;
  for (let index = 0; index <= raw.length; index += 1) {
    if (index !== raw.length && raw[index] !== 0x0a) continue;
    let lineEnd = index;
    if (lineEnd > lineStart && raw[lineEnd - 1] === 0x0d) lineEnd -= 1;
    if (isSeparator(lineStart, lineEnd)) separators.push(lineStart);
    lineStart = index + 1;
  }
  if (!separators.length) throw new Error('archive_mbox_invalid');

  return separators.map((separator, messageIndex) => {
    const nextSeparator = separators[messageIndex + 1] ?? raw.length;
    let cursor = separator;
    while (cursor < nextSeparator && raw[cursor] !== 0x0a) cursor += 1;
    if (cursor < nextSeparator) cursor += 1;
    const output: number[] = [];
    let start = cursor;
    for (let index = cursor; index <= nextSeparator; index += 1) {
      if (index !== nextSeparator && raw[index] !== 0x0a) continue;
      const end = index;
      const escaped = end - start >= 6 && raw[start] === 0x3e && isSeparator(start + 1, end);
      if (escaped) start += 1;
      for (let byte = start; byte < end; byte += 1) output.push(raw[byte]);
      if (index < nextSeparator) output.push(0x0a);
      start = index + 1;
    }
    const message = new Uint8Array(output);
    if (!message.byteLength) throw new Error('archive_mbox_empty_message');
    return message;
  });
}

type ZipEntry = { path: string; content: Uint8Array };

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function safeZipPath(path: string) {
  const normalized = path.replaceAll('\\', '/');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[a-z]:/i.test(normalized) ||
    normalized.split('/').some((part) => part === '..' || part === '.')
  ) {
    throw new Error('archive_path_invalid');
  }
  return normalized;
}

async function inflateRaw(bytes: Uint8Array, expectedBytes: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('archive_deflate_unsupported');
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  } catch {
    throw new Error('archive_deflate_unsupported');
  }
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > expectedBytes || size > 25_000_000) {
        await reader.cancel();
        throw new Error('archive_expanded_size_limit');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function extractZipArchive(raw: Uint8Array): Promise<ZipEntry[]> {
  if (!raw.byteLength || raw.byteLength > 100_000_000) throw new Error('archive_size_limit');
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const minEnd = Math.max(0, raw.byteLength - 65_557);
  let endOffset = -1;
  for (let offset = raw.byteLength - 22; offset >= minEnd; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error('archive_zip_invalid');
  const entryCount = view.getUint16(endOffset + 10, true);
  const centralSize = view.getUint32(endOffset + 12, true);
  const centralOffset = view.getUint32(endOffset + 16, true);
  if (!entryCount || entryCount > 500 || centralOffset + centralSize > endOffset)
    throw new Error('archive_entry_limit');

  const decoder = new TextDecoder('utf-8', { fatal: false });
  const entries: ZipEntry[] = [];
  let totalExpanded = 0;
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > raw.byteLength || view.getUint32(cursor, true) !== 0x02014b50)
      throw new Error('archive_zip_invalid');
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const expectedCrc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const expandedSize = view.getUint32(cursor + 24, true);
    const filenameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + filenameLength;
    const next = nameEnd + extraLength + commentLength;
    if (next > raw.byteLength || localOffset + 30 > centralOffset || view.getUint32(localOffset, true) !== 0x04034b50)
      throw new Error('archive_zip_invalid');
    const entryPath = safeZipPath(decoder.decode(raw.slice(nameStart, nameEnd)));
    cursor = next;
    if (entryPath.endsWith('/')) continue;
    if (flags & 1) throw new Error('archive_encrypted_unsupported');
    if (expandedSize > 25_000_000 || totalExpanded + expandedSize > 100_000_000)
      throw new Error('archive_expanded_size_limit');
    if (!/\.(eml|mbox)$/i.test(entryPath)) throw new Error('archive_format_unsupported');

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > centralOffset || dataStart > dataEnd) throw new Error('archive_zip_invalid');
    const localPath = safeZipPath(decoder.decode(raw.slice(localOffset + 30, localOffset + 30 + localNameLength)));
    if (localPath !== entryPath) throw new Error('archive_zip_invalid');
    const compressed = raw.slice(dataStart, dataEnd);
    let content: Uint8Array;
    if (method === 0) content = compressed;
    else if (method === 8) content = await inflateRaw(compressed, expandedSize);
    else throw new Error('archive_compression_unsupported');
    if (content.byteLength !== expandedSize || crc32(content) !== expectedCrc)
      throw new Error('archive_checksum_invalid');
    totalExpanded += content.byteLength;
    entries.push({ path: entryPath, content });
  }
  if (!entries.length) throw new Error('archive_empty');
  return entries;
}

export async function parseImportedMessage(
  raw: Uint8Array,
  source: ImportSourceMetadata,
): Promise<ParsedImportMessage> {
  if (!raw.byteLength || raw.byteLength > MAX_MESSAGE_BYTES) {
    throw new Error('source_message_size_limit');
  }

  let parsed: Awaited<ReturnType<typeof PostalMime.parse>>;
  try {
    parsed = await PostalMime.parse(raw, {
      attachmentEncoding: 'arraybuffer',
      maxNestingDepth: 32,
      maxHeadersSize: MAX_HEADERS_SIZE,
    });
  } catch {
    throw new Error('source_message_invalid_mime');
  }

  const from = addressStrings(parsed.from)[0] ?? '';
  if (!from) throw new Error('source_message_missing_sender');

  const attachments = parsed.attachments.map((attachment, index) => {
    const content = attachmentBytes(attachment.content);
    if (content.byteLength > MAX_ATTACHMENT_BYTES) throw new Error('source_attachment_size_limit');
    return {
      filename: safeAttachmentFilename(attachment.filename, index),
      contentType: String(attachment.mimeType || 'application/octet-stream').slice(0, 255),
      content,
    };
  });

  const text = typeof parsed.text === 'string' ? parsed.text.slice(0, MAX_BODY_CHARS) : '';
  const html = typeof parsed.html === 'string' ? parsed.html.slice(0, MAX_BODY_CHARS) : '';
  const occurredAtCandidate = parsed.date ? new Date(parsed.date) : null;
  const occurredAt = occurredAtCandidate && Number.isFinite(occurredAtCandidate.getTime()) ? occurredAtCandidate : null;

  return {
    raw,
    folderPath: source.folderPath.slice(0, 1024),
    folder: categoryForFolder(source.folderPath, source.specialUse),
    isRead: source.flags.some((flag) => flag.toLowerCase() === '\\seen'),
    from,
    to: addressStrings(parsed.to),
    cc: addressStrings(parsed.cc),
    bcc: addressStrings(parsed.bcc),
    subject: String(parsed.subject ?? '').slice(0, 500),
    messageId: String(parsed.messageId ?? '').slice(0, 1000) || null,
    occurredAt,
    text,
    html,
    preview: previewText(text, html),
    attachments,
  };
}
