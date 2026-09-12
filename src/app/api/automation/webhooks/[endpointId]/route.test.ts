import { handleAutomationWebhookIngress } from '@/features/projects/workspaces/automation/webhook-ingress';

import { POST } from './route';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, { status }: { status: number }) => ({ status, json: async () => body }),
  },
}));
jest.mock('@/features/projects/workspaces/automation/webhook-ingress', () => ({ handleAutomationWebhookIngress: jest.fn() }));
jest.mock('@/features/projects/workspaces/automation/webhook-server-dependencies', () => ({ automationWebhookServerDependencies: { marker: true } }));

const handleIngress = jest.mocked(handleAutomationWebhookIngress);
const request = { marker: 'request' } as unknown as Request;

describe('automation webhook route', () => {
  beforeEach(() => handleIngress.mockReset());

  it('passes endpoint id and request to ingress and returns its status/body', async () => {
    handleIngress.mockResolvedValue({ status: 200, body: { ok: true } });

    const response = await POST(request, { params: Promise.resolve({ endpointId: 'public-endpoint' }) });

    expect(handleIngress).toHaveBeenCalledWith(expect.objectContaining({ endpointId: 'public-endpoint', request }), expect.any(Object));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('preserves generic ingress error responses without leaking details', async () => {
    handleIngress.mockResolvedValue({ status: 401, body: { error: 'Webhook authentication failed.' } });
    const response = await POST(request, { params: Promise.resolve({ endpointId: 'public-endpoint' }) });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Webhook authentication failed.' });
  });
});
