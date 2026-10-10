/** @jest-environment node */
import {
  assertPublicImapSocketPeer,
  ImapSession,
  type ImapSocket,
  isPublicImapRemoteAddress,
  validateImapEndpoint,
} from '../../../../workers/mail-migration/src/imap-session';

function makeImapSocket() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  const raw = encoder.encode('From: sender@example.net\r\nTo: hello@mkety.com\r\nSubject: Hello\r\n\r\nBody');
  const readable = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
      controller.enqueue(encoder.encode('* OK ready\r\n'));
    },
  });
  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      const [tag, command] = new TextDecoder()
        .decode(chunk)
        .trim()
        .split(/\s+(.+)/);
      if (command === 'CAPABILITY') controller.enqueue(encoder.encode(`* CAPABILITY IMAP4rev1 UIDPLUS\r\n${tag} OK capabilities\r\n`));
      else if (command.startsWith('LOGIN')) controller.enqueue(encoder.encode(`${tag} OK logged in\r\n`));
      else if (command === 'LIST "" "*"')
        controller.enqueue(
          encoder.encode(
            `* LIST (\\Inbox) "/" "INBOX"\r\n* LIST (\\Sent) "/" "Sent\\\" Items"\r\n* LIST (\\Noselect) "/" "Archive"\r\n${tag} OK listed\r\n`,
          ),
        );
      else if (command.startsWith('EXAMINE'))
        controller.enqueue(
          encoder.encode(`* OK [UIDVALIDITY 4242] valid\r\n* OK [UIDNEXT 8] next\r\n${tag} OK selected\r\n`),
        );
      else if (command === 'UID SEARCH UID 1:7')
        controller.enqueue(encoder.encode('* SEARCH 7\r\n' + `${tag} OK searched\r\n`));
      else if (command.startsWith('UID FETCH')) {
        controller.enqueue(encoder.encode(`* 1 FETCH (UID 7 FLAGS (\\Seen) BODY[] {${raw.byteLength}}\r\n`));
        controller.enqueue(raw);
        controller.enqueue(encoder.encode(`\r\n)\r\n${tag} OK fetched\r\n`));
      } else if (command === 'LOGOUT') controller.enqueue(encoder.encode(`* BYE\r\n${tag} OK logged out\r\n`));
      else controller.enqueue(encoder.encode(`${tag} BAD unsupported\r\n`));
    },
  });
  const socket: ImapSocket = { readable, writable, close: () => undefined };
  return { socket, raw };
}

describe('provider-neutral IMAP session', () => {
  test('allows public DNS hostnames only on implicit TLS port 993', () => {
    expect(validateImapEndpoint('imap.zoho.com', 993)).toBe('imap.zoho.com');
    expect(() => validateImapEndpoint('127.0.0.1', 993)).toThrow('imap_endpoint_disallowed');
    expect(() => validateImapEndpoint('metadata.google.internal', 993)).toThrow('imap_endpoint_disallowed');
    expect(() => validateImapEndpoint('imap.example.com', 143)).toThrow('imap_endpoint_invalid');
  });

  test('allows only public peer IPs after DNS resolution and TCP connection', () => {
    expect(isPublicImapRemoteAddress('8.8.8.8')).toBe(true);
    expect(isPublicImapRemoteAddress('2606:4700:4700::1111')).toBe(true);
    for (const address of [
      null,
      undefined,
      'not-an-ip',
      '0.0.0.0',
      '10.1.2.3',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.1.1',
      '172.20.0.1',
      '192.168.1.1',
      '224.0.0.1',
      '::',
      '::1',
      '::ffff:127.0.0.1',
      'fc00::1',
      'fd12::1',
      'fe80::1',
      'ff02::1',
      '2001:db8::1',
    ]) {
      expect(isPublicImapRemoteAddress(address)).toBe(false);
    }
  });

  test('closes a socket with an unsafe or missing peer address before creating the IMAP session', async () => {
    const close = jest.fn();
    await expect(
      assertPublicImapSocketPeer({
        readable: new ReadableStream<Uint8Array>(),
        writable: new WritableStream<Uint8Array>(),
        opened: Promise.resolve({ remoteAddress: '127.0.0.1' }),
        close,
      }),
    ).rejects.toThrow('imap_endpoint_disallowed');
    expect(close).toHaveBeenCalledTimes(1);

    const missingAddressClose = jest.fn();
    await expect(
      assertPublicImapSocketPeer({
        readable: new ReadableStream<Uint8Array>(),
        writable: new WritableStream<Uint8Array>(),
        opened: Promise.resolve({ remoteAddress: null }),
        close: missingAddressClose,
      }),
    ).rejects.toThrow('imap_endpoint_disallowed');
    expect(missingAddressClose).toHaveBeenCalledTimes(1);
  });

  test('lists folders, selects read-only and fetches the raw message with UID metadata', async () => {
    const { socket, raw } = makeImapSocket();
    const session = new ImapSession(socket);
    await session.greeting();
    await expect(session.capability()).resolves.toEqual(['IMAP4REV1', 'UIDPLUS']);
    await session.login('hello@example.net', 'app-password');
    const folders = await session.listFolders();
    expect(folders).toEqual([
      { path: 'INBOX', specialUse: ['\\inbox'] },
      { path: 'Sent" Items', specialUse: ['\\sent'] },
    ]);
    const { uidValidity, uidNext } = await session.examine('INBOX');
    expect(uidNext).toBe('8');
    const uids = await session.searchUidRange('1', String(BigInt(uidNext) - 1n));
    const message = await session.fetchMessage(uids[0], 'INBOX', uidValidity);
    expect(message).toEqual({ folderPath: 'INBOX', uid: '7', uidValidity: '4242', flags: ['\\Seen'], raw });
    await session.logout();
  });
});
