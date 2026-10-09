export type ImapSocket = {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  close(): Promise<void> | void;
};

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

function parseQuoted(value: string) {
  if (!value.startsWith('"') || !value.endsWith('"')) return value;
  return value.slice(1, -1).replace(/\\([\\"])/g, '$1');
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
      const match = chunk.line.match(/^\* LIST \(([^)]*)\) ("(?:\\.|[^"])*"|NIL) ("(?:\\.|[^"])*"|[^ ]+)$/i);
      if (!match || /\\noselect/i.test(match[1])) continue;
      const path = match[3].toUpperCase() === 'NIL' ? '' : parseQuoted(match[3]);
      if (!path) continue;
      const specialUse = [...match[1].matchAll(/\\([a-z]+)/gi)].map((item) => `\\${item[1].toLowerCase()}`);
      folders.push({ path: path.slice(0, 1024), specialUse });
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
