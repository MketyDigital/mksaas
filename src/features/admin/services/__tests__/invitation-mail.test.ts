import { deliverTenantInvitation } from '../invitation-mail';

describe('deliverTenantInvitation', () => {
  const invite = {
    id: 'invite-1',
    email: 'person@example.com',
    token: 'long-secret-invite-token',
    firstName: '<Rae>',
    message: '<script>no</script>',
    expiresAt: new Date('2026-10-09T12:00:00.000Z'),
    inviteUrl: 'https://app.mkety.com/app/acme/invite/long-secret-invite-token',
  };

  it('queues an invitation with the expiry and URL and token-derived idempotency', async () => {
    const send = jest.fn().mockResolvedValue({ ok: true, messageId: 'message-1', status: 'queued' });

    const result = await deliverTenantInvitation('Acme', invite, send);

    expect(result).toBe('queued');
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      category: 'invitation',
      to: 'person@example.com',
      idempotencyKey: expect.stringMatching(/^invitation:invite-1:[a-f0-9]{64}$/),
      text: expect.stringContaining(invite.inviteUrl),
    }));
    expect(send.mock.calls[0][0].text).toContain('October 9, 2026');
    expect(send.mock.calls[0][0].html).not.toContain('<script>');
    expect(send.mock.calls[0][0].html).toContain('&lt;script&gt;');
  });

  it('keeps the invitation retryable when send fails or throws', async () => {
    await expect(deliverTenantInvitation('Acme', invite, jest.fn().mockResolvedValue({ ok: false, reason: 'not_ready' }))).resolves.toBe('pending');
    await expect(deliverTenantInvitation('Acme', invite, jest.fn().mockRejectedValue(new Error('queue down')))).resolves.toBe('pending');
  });
});
