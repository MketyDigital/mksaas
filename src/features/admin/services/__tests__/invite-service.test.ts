const mockRequireTenantAdmin = jest.fn();
const mockSendPlatformMail = jest.fn();
const mockLoggerError = jest.fn();
const mockTenantFindFirst = jest.fn();
const mockInvitationFindFirst = jest.fn();
const mockUserFindFirst = jest.fn();
const mockMembershipFindFirst = jest.fn();
const mockRoleFindFirst = jest.fn();
const mockInsertReturning = jest.fn();
const mockUpdateReturning = jest.fn();

jest.mock('@/shared/db', () => ({
  db: {
    query: {
      tenants: { findFirst: (...args: unknown[]) => mockTenantFindFirst(...args) },
      tenantInvitations: { findFirst: (...args: unknown[]) => mockInvitationFindFirst(...args) },
      users: { findFirst: (...args: unknown[]) => mockUserFindFirst(...args) },
      tenantMemberships: { findFirst: (...args: unknown[]) => mockMembershipFindFirst(...args) },
      roles: { findFirst: (...args: unknown[]) => mockRoleFindFirst(...args) },
    },
    insert: jest.fn(() => ({ values: jest.fn(() => ({ returning: (...args: unknown[]) => mockInsertReturning(...args) })) })),
    update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn(() => ({ returning: (...args: unknown[]) => mockUpdateReturning(...args) })) })) })),
  },
}));

jest.mock('@/shared/lib/logger', () => ({ logger: { error: (...args: unknown[]) => mockLoggerError(...args), info: jest.fn() } }));
jest.mock('@/shared/lib/rbac', () => ({ requireTenantAdmin: (...args: unknown[]) => mockRequireTenantAdmin(...args) }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/features/mail/server/platform-sender', () => ({ sendPlatformMail: (...args: unknown[]) => mockSendPlatformMail(...args) }));

import { createInvite, resendInvite } from '../invite-service';

const inviter = { id: 'ops-user', name: 'Ops', email: 'ops@mkety.com' };
const tenant = { id: 'tenant-1', slug: 'acme', name: 'Acme' };
const invite = {
  id: 'invite-1', tenantId: 'tenant-1', email: 'person@example.com', token: 'secret-token', role: 'member', roleId: 'role-1',
  status: 'pending', firstName: 'Rae', lastName: null, message: 'Welcome', expiresAt: new Date('2026-10-09T00:00:00Z'),
  createdAt: new Date('2026-10-02T00:00:00Z'),
};

function setupCreate() {
  mockRequireTenantAdmin.mockResolvedValue({ userId: inviter.id, email: inviter.email, role: 'admin' });
  mockTenantFindFirst.mockResolvedValue(tenant);
  mockInvitationFindFirst.mockResolvedValue(null);
  mockUserFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(inviter);
  mockMembershipFindFirst.mockResolvedValue(null);
  mockRoleFindFirst.mockResolvedValue({ id: 'role-1', name: 'Member' });
  mockInsertReturning.mockResolvedValue([invite]);
}

describe('invite-service Mail delivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.mkety.com';
  });

  it('creates an invitation and queues an email with its expiry URL', async () => {
    setupCreate();
    mockSendPlatformMail.mockResolvedValue({ ok: true, messageId: 'message-1', status: 'queued' });

    const result = await createInvite('acme', { email: invite.email, firstName: 'Rae' });

    expect(result.success).toBe(true);
    expect(result.data?.emailDeliveryStatus).toBe('queued');
    expect(mockSendPlatformMail).toHaveBeenCalledWith(expect.objectContaining({
      category: 'invitation',
      to: invite.email,
      text: expect.stringContaining('/app/acme/invite/secret-token'),
      idempotencyKey: expect.stringMatching(/^invitation:invite-1:[a-f0-9]{64}$/),
    }));
    expect(mockSendPlatformMail.mock.calls[0][0].text).toContain('October 9, 2026');
  });

  it('uses the production app URL when the public URL setting is missing', async () => {
    setupCreate();
    delete process.env.NEXT_PUBLIC_APP_URL;
    mockSendPlatformMail.mockResolvedValue({ ok: true, messageId: 'message-1', status: 'queued' });

    await createInvite('acme', { email: invite.email });

    expect(mockSendPlatformMail.mock.calls[0][0].text).toContain('https://app.mkety.com/app/acme/invite/secret-token');
  });

  it('keeps the invite pending and retryable when mail queue submission fails', async () => {
    setupCreate();
    mockSendPlatformMail.mockResolvedValue({ ok: false, reason: 'queue_failed' });

    const result = await createInvite('acme', { email: invite.email });

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('pending');
    expect(result.data?.emailDeliveryStatus).toBe('pending');
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('resends with a fresh invite token and a distinct idempotency key', async () => {
    mockRequireTenantAdmin.mockResolvedValue({ userId: inviter.id, email: inviter.email, role: 'admin' });
    mockTenantFindFirst.mockResolvedValue(tenant);
    mockInvitationFindFirst.mockResolvedValue({ ...invite, invitedBy: inviter, roleRef: { name: 'Member' } });
    const updated = { ...invite, token: 'new-secret-token', expiresAt: new Date('2026-10-09T00:00:00Z') };
    mockUpdateReturning.mockResolvedValue([updated]);
    mockSendPlatformMail.mockResolvedValue({ ok: true, messageId: 'message-2', status: 'queued' });

    const result = await resendInvite('acme', invite.id);

    expect(result.success).toBe(true);
    expect(result.data?.emailDeliveryStatus).toBe('queued');
    expect(mockSendPlatformMail.mock.calls[0][0].text).toContain('/app/acme/invite/new-secret-token');
    expect(mockSendPlatformMail.mock.calls[0][0].idempotencyKey).not.toContain('secret-token');
  });
});
