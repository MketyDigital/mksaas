/** @jest-environment node */

const mockAuthenticateExternalMailClient = jest.fn();

jest.mock('@/features/mail/server/gateway-auth', () => ({
  authenticateExternalMailClient: (...args: unknown[]) => mockAuthenticateExternalMailClient(...args),
  requireMailGatewaySecret: (request: Request) => request.headers.get('authorization') === 'Bearer fixture',
}));
jest.mock('@/shared/db/request', () => ({ withRequestDatabase: (work: () => unknown) => work() }));
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, options?: ResponseInit) => new Response(JSON.stringify(body), {
      ...options,
      headers: { 'content-type': 'application/json', ...(options?.headers || {}) },
    }),
  },
}));

import { POST } from './route';

function authRequest(body: Record<string, unknown>) {
  return new Request('https://api.example.com/api/internal/mail/gateway/auth', {
    method: 'POST',
    headers: { authorization: 'Bearer fixture', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Mail gateway auth route', () => {
  beforeEach(() => mockAuthenticateExternalMailClient.mockReset());

  it('rejects unsupported protocol values before credential authentication', async () => {
    const response = await POST(authRequest({ username: 'info@mkety.com', password: 'fixture', protocol: 'pop3' }));
    expect(response.status).toBe(400);
    expect(mockAuthenticateExternalMailClient).not.toHaveBeenCalled();
  });

  it('passes the validated protocol to the credential authorization boundary', async () => {
    mockAuthenticateExternalMailClient.mockResolvedValue({ tenantId: 'system', mailboxId: 'info' });
    const response = await POST(authRequest({ username: 'info@mkety.com', password: 'fixture', protocol: 'smtp' }));
    expect(response.status).toBe(200);
    expect(mockAuthenticateExternalMailClient).toHaveBeenCalledWith('info@mkety.com', 'fixture', 'smtp');
  });
});
