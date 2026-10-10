/** @jest-environment node */

import { deflateRawSync } from 'node:zlib';

import {
  extractZipArchive,
  fingerprintImportedMessage,
  parseImportedMessage,
  parseMbox,
} from './migration-import-core';

const rawMessage = new TextEncoder().encode(
  [
    'From: Sender <sender@example.net>',
    'To: cloudflare@mkety.com',
    'Subject: Previous alias message',
    'Date: Thu, 08 Oct 2026 10:00:00 +0000',
    'Message-ID: <alias-history-1@example.net>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'This was delivered through the old alias into the single hello mailbox.',
  ].join('\r\n'),
);

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createStoredZip(path: string, content: Uint8Array) {
  const pathBytes = new TextEncoder().encode(path);
  const local = new Uint8Array(30 + pathBytes.length + content.length);
  const localView = new DataView(local.buffer);
  localView.setUint32(0, 0x04034b50, true);
  localView.setUint16(4, 20, true);
  localView.setUint32(14, crc32(content), true);
  localView.setUint32(18, content.length, true);
  localView.setUint32(22, content.length, true);
  localView.setUint16(26, pathBytes.length, true);
  local.set(pathBytes, 30);
  local.set(content, 30 + pathBytes.length);

  const central = new Uint8Array(46 + pathBytes.length);
  const centralView = new DataView(central.buffer);
  centralView.setUint32(0, 0x02014b50, true);
  centralView.setUint16(4, 20, true);
  centralView.setUint16(6, 20, true);
  centralView.setUint32(16, crc32(content), true);
  centralView.setUint32(20, content.length, true);
  centralView.setUint32(24, content.length, true);
  centralView.setUint16(28, pathBytes.length, true);
  centralView.setUint32(42, 0, true);
  central.set(pathBytes, 46);

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, 1, true);
  endView.setUint16(10, 1, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, local.length, true);

  const result = new Uint8Array(local.length + central.length + end.length);
  result.set(local);
  result.set(central, local.length);
  result.set(end, local.length + central.length);
  return result;
}

async function createDeflatedZip(path: string, content: Uint8Array) {
  const compressed = new Uint8Array(deflateRawSync(content));
  const pathBytes = new TextEncoder().encode(path);
  const local = new Uint8Array(30 + pathBytes.length + compressed.length);
  const localView = new DataView(local.buffer);
  localView.setUint32(0, 0x04034b50, true);
  localView.setUint16(4, 20, true);
  localView.setUint16(8, 8, true);
  localView.setUint32(14, crc32(content), true);
  localView.setUint32(18, compressed.length, true);
  localView.setUint32(22, content.length, true);
  localView.setUint16(26, pathBytes.length, true);
  local.set(pathBytes, 30);
  local.set(compressed, 30 + pathBytes.length);

  const central = new Uint8Array(46 + pathBytes.length);
  const centralView = new DataView(central.buffer);
  centralView.setUint32(0, 0x02014b50, true);
  centralView.setUint16(4, 20, true);
  centralView.setUint16(6, 20, true);
  centralView.setUint16(10, 8, true);
  centralView.setUint32(16, crc32(content), true);
  centralView.setUint32(20, compressed.length, true);
  centralView.setUint32(24, content.length, true);
  centralView.setUint16(28, pathBytes.length, true);
  centralView.setUint32(42, 0, true);
  central.set(pathBytes, 46);

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, 1, true);
  endView.setUint16(10, 1, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, local.length, true);
  const result = new Uint8Array(local.length + central.length + end.length);
  result.set(local);
  result.set(central, local.length);
  result.set(end, local.length + central.length);
  return result;
}

describe('provider-neutral Mail import parsing', () => {
  it('preserves alias recipient headers and source folder without splitting source mailbox history', async () => {
    const parsed = await parseImportedMessage(rawMessage, {
      folderPath: 'INBOX',
      flags: ['\\Seen'],
    });

    expect(parsed.from).toBe('sender@example.net');
    expect(parsed.to).toEqual(['cloudflare@mkety.com']);
    expect(parsed.folderPath).toBe('INBOX');
    expect(parsed.folder).toBe('inbox');
    expect(parsed.isRead).toBe(true);
    expect(parsed.messageId).toBe('<alias-history-1@example.net>');
    expect(parsed.text).toContain('single hello mailbox');
  });

  it('keeps messages from a source sent folder in the Sent category', async () => {
    const sent = new TextEncoder().encode(
      [
        'From: hello@mkety.com',
        'To: customer@example.net',
        'Subject: Sent message',
        'Date: Thu, 08 Oct 2026 10:00:00 +0000',
        '',
        'Sent from the source account.',
      ].join('\r\n'),
    );

    const parsed = await parseImportedMessage(sent, { folderPath: 'Sent Items', flags: [] });

    expect(parsed.folderPath).toBe('Sent Items');
    expect(parsed.folder).toBe('sent');
    expect(parsed.isRead).toBe(false);
  });

  it('produces a stable content fingerprint for retry-safe imports', async () => {
    await expect(fingerprintImportedMessage(rawMessage)).resolves.toBe(await fingerprintImportedMessage(rawMessage));
  });

  it('rejects malformed messages without a sender', async () => {
    await expect(
      parseImportedMessage(new TextEncoder().encode('Subject: no sender\r\n\r\nbody'), {
        folderPath: 'INBOX',
        flags: [],
      }),
    ).rejects.toThrow('source_message_missing_sender');
  });

  it('splits MBOX messages and unescapes mboxrd body lines', () => {
    const mbox = new TextEncoder().encode(
      [
        'From alice@example.net Thu Oct 08 10:00:00 2026',
        'From: alice@example.net',
        'To: hello@mkety.com',
        'Subject: First',
        '',
        'Body one',
        '>From should be restored',
        'From bob@example.net Thu Oct 08 11:00:00 2026',
        'From: bob@example.net',
        'To: hello@mkety.com',
        'Subject: Second',
        '',
        'Body two',
        '',
      ].join('\n'),
    );

    const messages = parseMbox(mbox);

    expect(messages).toHaveLength(2);
    expect(new TextDecoder().decode(messages[0])).toContain('From should be restored');
    expect(new TextDecoder().decode(messages[1])).toContain('Subject: Second');
  });

  it('extracts only supported EML/MBOX entries from a stored ZIP archive', async () => {
    const archive = createStoredZip('hello/inbox.eml', rawMessage);

    const files = await extractZipArchive(archive);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('hello/inbox.eml');
    expect(files[0].content).toEqual(rawMessage);
  });

  it('supports raw deflate ZIP entries and verifies their expanded bytes', async () => {
    const archive = await createDeflatedZip('hello/inbox.eml', rawMessage);
    const files = await extractZipArchive(archive);
    expect(files[0].content).toEqual(rawMessage);
  });

  it('rejects ZIP paths that escape the import directory', async () => {
    await expect(extractZipArchive(createStoredZip('../outside.eml', rawMessage))).rejects.toThrow(
      'archive_path_invalid',
    );
  });

  it('rejects ZIP archives over the declared expanded-message limit', async () => {
    const archive = createStoredZip('inbox.eml', rawMessage);
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
    const endOffset = archive.byteLength - 22;
    const centralOffset = view.getUint32(endOffset + 16, true);
    view.setUint32(centralOffset + 24, 25_000_001, true);
    await expect(extractZipArchive(archive)).rejects.toThrow('archive_expanded_size_limit');
  });

  it('rejects ZIP archives with too many entries before reading their directory', async () => {
    const archive = new Uint8Array(22);
    const view = new DataView(archive.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, 501, true);
    view.setUint16(10, 501, true);
    await expect(extractZipArchive(archive)).rejects.toThrow('archive_entry_limit');
  });
});
