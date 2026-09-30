/** @jest-environment node */

import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import vm from 'node:vm';

class Socket extends EventEmitter {
  output = '';
  write(value: string | Buffer) { this.output += value.toString(); return true; }
  setTimeout() { return this; }
  end() { return this; }
}

function gateway() {
  const handlers = new Map<number, (socket: Socket) => void>();
  const messages = [{ uid: 1, from: 'a@example.com', to: [], subject: 'Fixture', internalDate: '2026-09-30T00:00:00Z', isRead: false, isStarred: true }];
  let flagsBody: Record<string, unknown> | undefined;
  let failFlags = false;
  let failBody = false;
  let revoked = false;
  let failMessages = false;
  const context = {
    Buffer, createHash, AbortSignal,
    console: { log: () => {}, error: () => {} },
    process: { env: { MKETY_MAIL_GATEWAY_INTERNAL_SECRET: 'fixture', MKETY_MAIL_GATEWAY_TLS_CERT_B64: 'AA==', MKETY_MAIL_GATEWAY_TLS_KEY_B64: 'AA==' }, exit: () => { throw new Error('exit'); } },
    tls: { createServer: (_options: unknown, callback: (socket: Socket) => void) => ({ on: () => {}, listen: (port: number) => handlers.set(port, callback) }) },
    http: { createServer: () => ({ listen: () => {} }) },
    fetch: async (url: string, options: { body: string }) => {
      // Force an asynchronous provider boundary so pipelined commands exercise ordering.
      await new Promise<void>((resolve) => setImmediate(resolve));
      if (url.endsWith('/auth')) return { ok: !revoked, json: async () => ({ ok: !revoked, tenantId: 'tenant', mailboxId: 'mailbox', address: 'a@example.com' }) };
      if (url.endsWith('/messages')) return { ok: !failMessages, json: async () => ({ ok: !failMessages, messages }) };
      if (url.endsWith('/flags')) {
        flagsBody = JSON.parse(options.body);
        return { ok: !failFlags, json: async () => ({ ok: !failFlags }) };
      }
      if (url.endsWith('/message')) return { ok: !failBody, arrayBuffer: async () => Buffer.from('Subject: Fixture\r\n\r\nBody') };
      return { ok: true, json: async () => ({ ok: true }) };
    },
  };
  const source = fs.readFileSync('ops/mail-gateway/gateway.mjs', 'utf8').replace(/^import .*;\n/gm, '');
  vm.runInNewContext(source, context);
  const connect = (port: number) => { const socket = new Socket(); handlers.get(port)!(socket); return socket; };
  const send = async (socket: Socket, line: string) => {
    socket.emit('data', Buffer.from(line));
    for (let tick = 0; tick < 15; tick += 1) await new Promise<void>((resolve) => setImmediate(resolve));
  };
  return { connect, send, flags: () => flagsBody, failFlags: () => { failFlags = true; }, failBody: () => { failBody = true; }, revoke: () => { revoked = true; }, failMessages: (fail: boolean) => { failMessages = fail; } };
}

describe('Mail gateway protocol behavior', () => {
  it('serializes IMAP commands arriving in separate chunks during authentication', async () => {
    const g = gateway(); const socket = g.connect(993);
    socket.emit('data', Buffer.from('a1 LOGIN a@example.com mkmail-fixture\r\n'));
    await g.send(socket, 'a2 SELECT INBOX\r\n');
    expect(socket.output).toContain('a2 OK');
    expect(socket.output.indexOf('a1 OK')).toBeLessThan(socket.output.indexOf('a2 OK'));
  });

  it('terminates IDLE with the original command tag after bare DONE', async () => {
    const g = gateway(); const socket = g.connect(993);
    await g.send(socket, 'a1 LOGIN a@example.com mkmail-fixture\r\n');
    await g.send(socket, 'a2 IDLE\r\n');
    await g.send(socket, 'DONE\r\n');
    expect(socket.output).toContain('a2 OK IDLE terminated');
  });

  it('rejects flag mutations after EXAMINE', async () => {
    const g = gateway(); const socket = g.connect(993);
    await g.send(socket, 'a1 LOGIN a@example.com mkmail-fixture\r\n');
    await g.send(socket, 'a2 EXAMINE INBOX\r\n');
    await g.send(socket, 'a3 STORE 1 +FLAGS (\\Seen)\r\n');
    expect(socket.output).toContain('a3 NO');
    expect(g.flags()).toBeUndefined();
  });

  it('replaces flags rather than preserving omitted flags for FLAGS', async () => {
    const g = gateway(); const socket = g.connect(993);
    await g.send(socket, 'a1 LOGIN a@example.com mkmail-fixture\r\n');
    await g.send(socket, 'a2 SELECT INBOX\r\n');
    await g.send(socket, 'a3 STORE 1 FLAGS (\\Seen)\r\n');
    expect(g.flags()).toMatchObject({ isRead: true, isStarred: false });
  });

  it('does not report successful STORE when the backend rejects the write', async () => {
    const g = gateway(); const socket = g.connect(993);
    await g.send(socket, 'a1 LOGIN a@example.com mkmail-fixture\r\n');
    await g.send(socket, 'a2 SELECT INBOX\r\n'); g.failFlags();
    await g.send(socket, 'a3 STORE 1 +FLAGS (\\Seen)\r\n');
    expect(socket.output).toContain('a3 NO');
    expect(socket.output).not.toContain('a3 OK');
  });

  it('does not report successful FETCH when message content is unavailable', async () => {
    const g = gateway(); const socket = g.connect(993);
    await g.send(socket, 'a1 LOGIN a@example.com mkmail-fixture\r\n');
    await g.send(socket, 'a2 SELECT INBOX\r\n'); g.failBody();
    await g.send(socket, 'a3 FETCH 1 (BODY.PEEK[])\r\n');
    expect(socket.output).toContain('a3 NO');
    expect(socket.output).not.toContain('a3 OK');
  });

  it('serializes SMTP authentication and pipelined envelope commands', async () => {
    const g = gateway(); const socket = g.connect(465);
    const credential = Buffer.from('\0a@example.com\0mkmail-fixture').toString('base64');
    socket.emit('data', Buffer.from(`AUTH PLAIN ${credential}\r\n`));
    await g.send(socket, 'MAIL FROM:<a@example.com>\r\nRCPT TO:<b@example.com>\r\n');
    expect(socket.output).toContain('250 2.1.0 Sender OK');
    expect(socket.output).toContain('250 2.1.5 Recipient OK');
    expect(socket.output).not.toContain('530 ');
  });

  it('returns RFC822.SIZE without an unsolicited message-body literal', async () => {
    const g = gateway(); const socket = g.connect(993);
    await g.send(socket, 'a1 LOGIN a@example.com mkmail-fixture\r\n');
    await g.send(socket, 'a2 SELECT INBOX\r\n');
    await g.send(socket, 'a3 FETCH 1 (RFC822.SIZE)\r\n');
    expect(socket.output).toContain('RFC822.SIZE 24');
    expect(socket.output).not.toMatch(/RFC822 \{\d+\}/);
  });

  it('uses the IMAP date-time syntax for INTERNALDATE', async () => {
    const g = gateway(); const socket = g.connect(993);
    await g.send(socket, 'a1 LOGIN a@example.com mkmail-fixture\r\n');
    await g.send(socket, 'a2 SELECT INBOX\r\n');
    await g.send(socket, 'a3 FETCH 1 (INTERNALDATE)\r\n');
    expect(socket.output).toContain('INTERNALDATE "30-Sep-2026 00:00:00 +0000"');
  });

  it('denies mailbox reads on an already authenticated connection after revocation', async () => {
    const g = gateway(); const socket = g.connect(993);
    await g.send(socket, 'a1 LOGIN a@example.com mkmail-fixture\r\n'); g.revoke();
    await g.send(socket, 'a2 SELECT INBOX\r\n');
    expect(socket.output).toContain('a2 NO');
    expect(socket.output).not.toContain('a2 OK');
  });

  it('denies SMTP submit if access is revoked during DATA', async () => {
    const g = gateway(); const socket = g.connect(465);
    const credential = Buffer.from('\0a@example.com\0mkmail-fixture').toString('base64');
    await g.send(socket, `AUTH PLAIN ${credential}\r\n`);
    await g.send(socket, 'MAIL FROM:<a@example.com>\r\nRCPT TO:<b@example.com>\r\nDATA\r\n');
    g.revoke();
    await g.send(socket, 'Subject: Fixture\r\n\r\nBody\r\n.\r\n');
    expect(socket.output).toContain('535 ');
    expect(socket.output).not.toContain('250 2.0.0 Message accepted');
  });

  it('does not become writable when SELECT fails after EXAMINE', async () => {
    const g = gateway(); const socket = g.connect(993);
    await g.send(socket, 'a1 LOGIN a@example.com mkmail-fixture\r\n');
    await g.send(socket, 'a2 EXAMINE INBOX\r\n'); g.failMessages(true);
    await g.send(socket, 'a3 SELECT INBOX\r\n'); g.failMessages(false);
    await g.send(socket, 'a4 STORE 1 +FLAGS (\\Seen)\r\n');
    expect(socket.output).toContain('a3 NO');
    expect(socket.output).toContain('a4 NO');
    expect(g.flags()).toBeUndefined();
  });
});
