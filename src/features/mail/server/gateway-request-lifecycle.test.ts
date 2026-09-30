/** @jest-environment node */

import { POST } from '@/app/api/internal/mail/gateway/messages/route';
import { getRequestDatabaseContext } from '@/shared/db/request-context';

const mockClients: Array<{ id: number; end: jest.Mock }> = [];

jest.mock('postgres', () => ({
  __esModule: true,
  default: () => {
    const client = { id: mockClients.length + 1, end: jest.fn().mockResolvedValue(undefined) };
    mockClients.push(client);
    return client;
  },
}));

jest.mock('drizzle-orm/postgres-js', () => ({
  drizzle: (client: { id: number }) => {
    const database = {
      select: () => {
        if (getRequestDatabaseContext() !== database) {
          throw new Error('Cannot perform I/O on behalf of a different request');
        }
        const query = {
          from: () => query, where: () => query, orderBy: () => query,
          limit: async (limit: number) => {
            await new Promise<void>((resolve) => setImmediate(resolve));
            if (getRequestDatabaseContext() !== database) throw new Error('Request context leaked');
            return limit === 1 ? [{ id: 'mailbox' }] : [{
              id: 'message', uid: 1, from: 'a@example.com', to: [], cc: [],
              subject: `request-${client.id}`, receivedAt: new Date(0),
            }];
          },
        };
        return query;
      },
    };
    return database;
  },
}));

jest.mock('@/shared/db/runtime-connection.cloudflare', () => ({
  getRuntimeDatabaseConnectionString: () => 'postgresql://fixture.invalid/test',
}));
jest.mock('@/features/mail/server/gateway-auth', () => ({
  requireMailGatewaySecret: (request: Request) => request.headers.get('authorization') === 'Bearer fixture',
}));
jest.mock('next/server', () => ({ NextResponse: { json: (body: unknown, options?: ResponseInit) =>
  new Response(JSON.stringify(body), { ...options, headers: { 'content-type': 'application/json' } }) } }));


function messageRequest() {
  return new Request('https://api.example.com/messages', {
    method: 'POST', headers: { authorization: 'Bearer fixture' },
    body: JSON.stringify({ tenantId: 'tenant', mailboxId: 'mailbox', limit: 500 }),
  });
}

describe('Mail gateway Worker database lifecycle', () => {
  it('serves repeated message-index requests with fresh clients and closes each client', async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const previous = mockClients.length;
      const response = await POST(messageRequest());
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, messages: [{ subject: `request-${previous + 1}` }] });
      expect(mockClients).toHaveLength(previous + 1);
      expect(mockClients.at(-1)?.end).toHaveBeenCalledTimes(1);
      expect(getRequestDatabaseContext()).toBeUndefined();
    }
  });

  it('isolates concurrent request clients across asynchronous queries', async () => {
    const previous = mockClients.length;
    const responses = await Promise.all([POST(messageRequest()), POST(messageRequest())]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const payloads = await Promise.all(responses.map((response) => response.json()));
    expect(payloads.map((payload) => payload.messages[0].subject)).toEqual([
      `request-${previous + 1}`, `request-${previous + 2}`,
    ]);
    expect(mockClients.slice(previous).every((client) => client.end.mock.calls.length === 1)).toBe(true);
    expect(getRequestDatabaseContext()).toBeUndefined();
  });

  it('rejects unauthorized requests before creating a database client', async () => {
    const previous = mockClients.length;
    const response = await POST(new Request('https://api.example.com/messages', { method: 'POST' }));
    expect(response.status).toBe(401);
    expect(mockClients).toHaveLength(previous);
    expect(getRequestDatabaseContext()).toBeUndefined();
  });
});
