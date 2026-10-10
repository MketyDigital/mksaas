import { isIP } from 'node:net';

export type ImapSocket = {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  close(): Promise<void> | void;
};

function parseIpv4(address: string) {
  const parts = address.split('.').map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? parts
    : null;
}

function isPublicIpv4(address: string) {
  const parts = parseIpv4(address);
  if (!parts) return false;
  const [first, second, third] = parts;
  if (first === 0 || first === 10 || first === 127 || first >= 224) return false;
  if (first === 100 && second >= 64 && second <= 127) return false;
  if (first === 169 && second === 254) return false;
  if (first === 172 && second >= 16 && second <= 31) return false;
  if (first === 192 && second === 168) return false;
  if (first === 192 && second === 0 && (third === 0 || third === 2)) return false;
  if (first === 192 && second === 88 && third === 99) return false;
  if (first === 198 && (second === 18 || second === 19 || (second === 51 && third === 100))) return false;
  if (first === 203 && second === 0 && third === 113) return false;
  return true;
}

function ipv6Words(address: string) {
  let normalized = address.toLowerCase();
  const dottedTail = normalized.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dottedTail) {
    const ipv4 = parseIpv4(dottedTail[1]);
    if (!ipv4) return null;
    const [a, b, c, d] = ipv4;
    normalized = normalized.replace(dottedTail[1], `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`);
  }
  const halves = normalized.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const words = [...left, ...Array(Math.max(0, missing)).fill('0'), ...right].map((word) => Number.parseInt(word, 16));
  return words.length === 8 && words.every((word) => Number.isInteger(word) && word >= 0 && word <= 0xffff)
    ? words
    : null;
}

/** Checks the connected peer address after the runtime resolves and opens the TLS socket. */
export function isPublicImapRemoteAddress(address: string | null | undefined) {
  if (!address) return false;
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family !== 6) return false;

  const words = ipv6Words(address);
  if (!words) return false;
  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
    return isPublicIpv4(`${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`);
  }
  if (words[0] < 0x2000 || words[0] > 0x3fff) return false;
  if (words[0] === 0x2001 && (words[1] <= 0x01ff || words[1] === 0x0db8)) return false;
  if (words[0] === 0x2002) return false;
  return true;
}

export async function assertPublicImapSocketPeer(
  socket: ImapSocket & { opened: Promise<{ remoteAddress: string | null }> },
) {
  try {
    const peer = await socket.opened;
    if (!isPublicImapRemoteAddress(peer.remoteAddress)) throw new Error('imap_endpoint_disallowed');
  } catch (error) {
    await socket.close();
    throw error;
  }
}

export type ImapFetchedMessage = {
  folderPath: string;
  uid: string;
  uidValidity: string;
  flags: string[];
  raw: Uint8Array;
};

type ImapChunk = { line: string; literal?: Uint8Array };
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: false });
const MAX_LINE_BYTES = 16_384;
const MAX_LITERAL_BYTES = 25_000_000;
const MAX_FOLDERS = 500;
const SEARCH_WINDOW = 500;

export function validateImapEndpoint(host: string, port: number) {
  const normalized = host.trim().toLowerCase().replace(/\.$/, '');
  if (
    port !== 993 ||
    !normalized ||
    normalized.length > 253 ||
    normalized.includes('://') ||
    normalized.includes('/') ||
    normalized.includes('@')
  ) {
    throw new Error('imap_endpoint_invalid');
  }
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal')
  ) {
    throw new Error('imap_endpoint_disallowed');
  }
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(normalized) || normalized.includes(':')) {
    throw new Error('imap_endpoint_disallowed');
  }
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalized)) {
    throw new Error('imap_endpoint_invalid');
  }
  return normalized;
}

function quote(value: string) {
  if (/[\r\n\0]/.test(value) || value.length > 1024) throw new Error('imap_credential_invalid');
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function readListValue(line: string, start: number) {
  let index = start;
  while (line[index] === ' ') index += 1;
  if (line[index] === '"') {
    index += 1;
    let value = '';
    while (index < line.length) {
      if (line[index] === '"') return { value, next: index + 1 };
      if (line[index] === '\\') {
        index += 1;
        if (index >= line.length) return null;
      }
      value += line[index];
      index += 1;
    }
    return null;
  }
  const end = line.indexOf(' ', index);
  return { value: line.slice(index, end < 0 ? line.length : end), next: end < 0 ? line.length : end };
}

function parseListEntry(chunk: ImapChunk) {
  const prefix = '* LIST ';
  if (chunk.line.slice(0, prefix.length).toUpperCase() !== prefix || chunk.line[prefix.length] !== '(') return null;
  const flagsEnd = chunk.line.indexOf(')', prefix.length + 1);
  if (flagsEnd < 0) return null;
  const flags = chunk.line.slice(prefix.length + 1, flagsEnd).split(' ').filter(Boolean);
  const delimiter = readListValue(chunk.line, flagsEnd + 1);
  if (!delimiter) return null;
  const mailbox = readListValue(chunk.line, delimiter.next);
  if (!mailbox) return null;
  if (flags.some((flag) => flag.toLowerCase() === '\\noselect')) return null;
  if (delimiter.value.toUpperCase() === 'NIL' || mailbox.value.toUpperCase() === 'NIL') return null;
  const specialUse = flags
    .filter((flag) => flag.startsWith('\\') && [...flag.slice(1)].every((char) => /[a-z0-9-]/i.test(char)))
    .map((flag) => flag.toLowerCase());
  const literalMarker = mailbox.value;
  const literalSize = literalMarker.startsWith('{') && literalMarker.endsWith('}')
    ? Number(literalMarker.slice(1, -1).replace(/\+$/, ''))
    : null;
  const path = literalSize !== null && chunk.literal?.byteLength === literalSize
    ? decoder.decode(chunk.literal)
    : mailbox.value;
  return { path, specialUse };
}

export class ImapSession {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly writer: WritableStreamDefaultWriter<Uint8Array>;
  private buffer = new Uint8Array();
  private bufferOffset = 0;
  private tag = 0;

  constructor(private readonly socket: ImapSocket) {
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
  }

  async greeting() {
    const line = await this.readLine();
    if (!/^\* (OK|PREAUTH)\b/i.test(line)) throw new Error('imap_greeting_rejected');
  }

  async capability() {
    const response = await this.command('CAPABILITY');
    this.assertOk(response, 'imap_capability_failed');
    const line = response.find((chunk) => /^\* CAPABILITY\s/i.test(chunk.line))?.line || '';
    return line.replace(/^\* CAPABILITY\s*/i, '').split(/\s+/).filter(Boolean).map((value) => value.toUpperCase());
  }

  async login(username: string, password: string) {
    const response = await this.command(`LOGIN ${quote(username)} ${quote(password)}`);
    this.assertOk(response, 'imap_login_failed');
  }

  async listFolders(): Promise<Array<{ path: string; specialUse: string[] }>> {
    const response = await this.command('LIST "" "*"');
    this.assertOk(response, 'imap_list_failed');
    const folders: Array<{ path: string; specialUse: string[] }> = [];
    for (const chunk of response) {
      const entry = parseListEntry(chunk);
      if (!entry?.path) continue;
      folders.push({ path: entry.path.slice(0, 1024), specialUse: entry.specialUse });
      if (folders.length > MAX_FOLDERS) throw new Error('imap_folder_limit');
    }
    return folders;
  }

  async examine(folder: string) {
    const response = await this.command(`EXAMINE ${quote(folder)}`);
    this.assertOk(response, 'imap_folder_open_failed');
    const line = response.find((chunk) => /\* OK \[UIDVALIDITY \d+\]/i.test(chunk.line))?.line || '';
    const uidValidity = line.match(/\[UIDVALIDITY (\d+)\]/i)?.[1];
    const uidNext = response
      .map((chunk) => chunk.line)
      .join(' ')
      .match(/\[UIDNEXT (\d+)\]/i)?.[1];
    if (!uidValidity || !uidNext) throw new Error('imap_uidvalidity_missing');
    return { uidValidity, uidNext };
  }

  async searchUidRange(startUid: string, endUid: string) {
    if (!/^\d{1,20}$/.test(startUid) || !/^\d{1,20}$/.test(endUid) || BigInt(startUid) > BigInt(endUid)) return [];
    const response = await this.command(`UID SEARCH UID ${startUid}:${endUid}`);
    this.assertOk(response, 'imap_search_failed');
    const line = response.find((chunk) => /^\* SEARCH(?: |$)/i.test(chunk.line))?.line || '* SEARCH';
    const uids = line
      .replace(/^\* SEARCH\s*/i, '')
      .trim()
      .split(/\s+/)
      .filter((uid) => /^\d{1,20}$/.test(uid));
    if (uids.length > SEARCH_WINDOW) throw new Error('imap_search_window_limit');
    return uids;
  }

  async fetchMessage(uid: string, folderPath: string, uidValidity: string): Promise<ImapFetchedMessage> {
    if (!/^\d{1,20}$/.test(uid)) throw new Error('imap_uid_invalid');
    const response = await this.command(`UID FETCH ${uid} (UID FLAGS BODY.PEEK[])`);
    this.assertOk(response, 'imap_fetch_failed');
    const fetchChunk = response.find((chunk) => chunk.literal && /\* \d+ FETCH/i.test(chunk.line));
    if (!fetchChunk?.literal || fetchChunk.literal.byteLength > MAX_LITERAL_BYTES)
      throw new Error('imap_fetch_literal_missing');
    const flags =
      fetchChunk.line
        .match(/FLAGS \(([^)]*)\)/i)?.[1]
        ?.split(/\s+/)
        .filter(Boolean) || [];
    return { folderPath, uid, uidValidity, flags, raw: fetchChunk.literal };
  }

  async logout() {
    try {
      const response = await this.command('LOGOUT');
      this.assertOk(response, 'imap_logout_failed');
    } finally {
      await this.close();
    }
  }

  async close() {
    try {
      await this.reader.cancel();
    } catch {
      /* socket may already be closed */
    }
    try {
      await this.writer.close();
    } catch {
      /* socket may already be closed */
    }
    await this.socket.close();
  }

  private async command(command: string): Promise<ImapChunk[]> {
    if (/[\r\n\0]/.test(command)) throw new Error('imap_command_invalid');
    const tag = `MK${String(++this.tag).padStart(6, '0')}`;
    await this.writer.write(encoder.encode(`${tag} ${command}\r\n`));
    const response: ImapChunk[] = [];
    while (response.length < 10_000) {
      const chunk = await this.readChunk();
      response.push(chunk);
      if (chunk.line.startsWith(`${tag} `)) return response;
    }
    throw new Error('imap_response_limit');
  }

  private assertOk(response: ImapChunk[], code: string) {
    const final = response.at(-1)?.line || '';
    if (!/^[A-Z0-9]+ OK\b/i.test(final)) throw new Error(code);
  }

  private async readChunk(): Promise<ImapChunk> {
    const line = await this.readLine();
    const literalSize = line.match(/\{(\d+)\+?\}$/)?.[1];
    if (!literalSize) return { line };
    const size = Number(literalSize);
    if (!Number.isSafeInteger(size) || size < 0 || size > MAX_LITERAL_BYTES) throw new Error('imap_literal_limit');
    const literal = await this.readBytes(size);
    return { line, literal };
  }

  private async readLine() {
    const bytes: number[] = [];
    while (bytes.length <= MAX_LINE_BYTES) {
      const byte = await this.readByte();
      if (byte === 0x0a) {
        if (bytes.at(-1) === 0x0d) bytes.pop();
        return decoder.decode(new Uint8Array(bytes));
      }
      bytes.push(byte);
    }
    throw new Error('imap_line_limit');
  }

  private async readBytes(size: number) {
    const bytes = new Uint8Array(size);
    let offset = 0;
    while (offset < size) {
      await this.fillBuffer();
      const available = this.buffer.byteLength - this.bufferOffset;
      const take = Math.min(size - offset, available);
      bytes.set(this.buffer.subarray(this.bufferOffset, this.bufferOffset + take), offset);
      this.bufferOffset += take;
      offset += take;
    }
    return bytes;
  }

  private async readByte() {
    await this.fillBuffer();
    return this.buffer[this.bufferOffset++];
  }

  private async fillBuffer() {
    if (this.bufferOffset < this.buffer.byteLength) return;
    const { done, value } = await this.reader.read();
    if (done || !value?.byteLength) throw new Error('imap_connection_closed');
    const copy = new Uint8Array(value.byteLength);
    copy.set(value);
    this.buffer = copy;
    this.bufferOffset = 0;
  }
}
