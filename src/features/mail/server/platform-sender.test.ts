import { isFirstPartyMailSendingDomainReady, sendPlatformMailWithDependencies } from './platform-sender-core';

const makeDependencies = () => ({
  resolve: jest.fn().mockResolvedValue({
    tenantId: 'reserved-tenant',
    mailboxId: 'platform-mailbox',
    domainId: 'mkety-domain',
    from: 'info@mkety.com',
    workspaceActive: true,
    entitled: true,
    domainReady: true,
  }),
  isSuppressed: jest.fn().mockResolvedValue(false),
  hasCapacity: jest.fn().mockResolvedValue(true),
  findByIdempotencyKey: jest.fn().mockResolvedValue(null),
  createMessage: jest.fn().mockResolvedValue({ id: 'message-1' }),
  retryFailedMessage: jest.fn().mockResolvedValue(false),
  enqueue: jest.fn().mockResolvedValue(undefined),
  setMessageStatus: jest.fn().mockResolvedValue(undefined),
});

const input = {
  category: 'account_security',
  to: 'Customer@example.com',
  subject: 'Security update',
  text: 'Your account security setting changed.',
  idempotencyKey: 'user-1:password-changed:attempt-1',
};

describe('first-party outbound domain readiness', () => {
  it('allows outbound-only readiness when authentication passes without root MX routing', () => {
    expect(isFirstPartyMailSendingDomainReady({ status: 'sending_ready', sendingEnabled: true, spfStatus: 'verified', dkimStatus: 'verified', dmarcStatus: 'verified' })).toBe(true);
  });
  it('fails closed while sending or any authentication record is unverified', () => {
    expect(isFirstPartyMailSendingDomainReady({ status: 'pending', sendingEnabled: true, spfStatus: 'verified', dkimStatus: 'verified', dmarcStatus: 'verified' })).toBe(false);
    expect(isFirstPartyMailSendingDomainReady({ status: 'sending_ready', sendingEnabled: false, spfStatus: 'verified', dkimStatus: 'verified', dmarcStatus: 'verified' })).toBe(false);
    expect(isFirstPartyMailSendingDomainReady({ status: 'verified', sendingEnabled: true, spfStatus: 'verified', dkimStatus: 'verified', dmarcStatus: 'verified' })).toBe(false);
    expect(isFirstPartyMailSendingDomainReady({ status: 'sending_ready', sendingEnabled: true, spfStatus: 'pending', dkimStatus: 'verified', dmarcStatus: 'verified' })).toBe(false);
  });
});

describe('sendPlatformMailWithDependencies', () => {
  it('queues through Mkety Mail with the fixed first-party sender', async () => {
    const dependencies = makeDependencies();

    const result = await sendPlatformMailWithDependencies(input, dependencies);

    expect(result).toEqual({ ok: true, messageId: 'message-1', status: 'queued' });
    expect(dependencies.createMessage).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'reserved-tenant',
      mailboxId: 'platform-mailbox',
      from: 'info@mkety.com',
      to: 'customer@example.com',
      status: 'queued',
    }));
    expect(dependencies.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'transactional',
      from: { email: 'info@mkety.com' },
      to: { email: 'customer@example.com' },
      replyTo: { email: 'support@mkety.com' },
    }));
  });

  it.each([
    ['bad recipient', { to: 'not-an-email' }, 'invalid_recipient'],
    ['unsupported category', { category: 'marketing' }, 'category_not_allowed'],
    ['missing idempotency key', { idempotencyKey: '' }, 'invalid_request'],
  ])('rejects %s before creating a message', async (_label, override, reason) => {
    const dependencies = makeDependencies();
    const result = await sendPlatformMailWithDependencies({ ...input, ...override }, dependencies);
    expect(result).toEqual({ ok: false, reason });
    expect(dependencies.createMessage).not.toHaveBeenCalled();
    expect(dependencies.enqueue).not.toHaveBeenCalled();
  });

  it('returns the existing queued message on idempotent replay', async () => {
    const dependencies = makeDependencies();
    dependencies.findByIdempotencyKey.mockResolvedValue({ id: 'previous-message' });

    const result = await sendPlatformMailWithDependencies(input, dependencies);

    expect(result).toEqual({ ok: true, messageId: 'previous-message', status: 'duplicate' });
    expect(dependencies.createMessage).not.toHaveBeenCalled();
    expect(dependencies.enqueue).not.toHaveBeenCalled();
  });

  it('requeues an existing failed message once when its idempotency key is retried', async () => {
    const dependencies = makeDependencies();
    dependencies.findByIdempotencyKey.mockResolvedValue({ id: 'previous-message', status: 'failed' });
    dependencies.retryFailedMessage.mockResolvedValue(true);

    const result = await sendPlatformMailWithDependencies(input, dependencies);

    expect(result).toEqual({ ok: true, messageId: 'previous-message', status: 'queued' });
    expect(dependencies.retryFailedMessage).toHaveBeenCalledWith('previous-message');
    expect(dependencies.enqueue).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'previous-message' }));
    expect(dependencies.createMessage).not.toHaveBeenCalled();
  });

  it('reports a claimed retry as a duplicate when another request already requeued it', async () => {
    const dependencies = makeDependencies();
    dependencies.findByIdempotencyKey.mockResolvedValue({ id: 'previous-message', status: 'failed' });

    const result = await sendPlatformMailWithDependencies(input, dependencies);

    expect(result).toEqual({ ok: true, messageId: 'previous-message', status: 'duplicate' });
    expect(dependencies.retryFailedMessage).toHaveBeenCalledWith('previous-message');
    expect(dependencies.enqueue).not.toHaveBeenCalled();
  });

  it('marks an existing message failed again when retry queue submission fails', async () => {
    const dependencies = makeDependencies();
    dependencies.findByIdempotencyKey.mockResolvedValue({ id: 'previous-message', status: 'failed' });
    dependencies.retryFailedMessage.mockResolvedValue(true);
    dependencies.enqueue.mockRejectedValue(new Error('queue unavailable'));

    const result = await sendPlatformMailWithDependencies(input, dependencies);

    expect(result).toEqual({ ok: false, reason: 'queue_failed' });
    expect(dependencies.setMessageStatus).toHaveBeenCalledWith('previous-message', 'failed');
  });

  it('requeues a failed message found through an insert uniqueness race', async () => {
    const dependencies = makeDependencies();
    dependencies.createMessage.mockResolvedValue({ id: 'previous-message', duplicate: true, status: 'failed' });
    dependencies.retryFailedMessage.mockResolvedValue(true);

    const result = await sendPlatformMailWithDependencies(input, dependencies);

    expect(result).toEqual({ ok: true, messageId: 'previous-message', status: 'queued' });
    expect(dependencies.enqueue).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'previous-message' }));
  });

  it('fails closed when the platform Mail path is not ready', async () => {
    const dependencies = makeDependencies();
    dependencies.resolve.mockResolvedValue({ ...await dependencies.resolve(), domainReady: false });

    const result = await sendPlatformMailWithDependencies(input, dependencies);

    expect(result).toEqual({ ok: false, reason: 'not_ready' });
    expect(dependencies.createMessage).not.toHaveBeenCalled();
  });

  it('rejects active suppressions and exhausted capacity before message creation', async () => {
    const suppressed = makeDependencies();
    suppressed.isSuppressed.mockResolvedValue(true);
    expect(await sendPlatformMailWithDependencies(input, suppressed)).toEqual({ ok: false, reason: 'suppressed' });
    expect(suppressed.createMessage).not.toHaveBeenCalled();

    const limited = makeDependencies();
    limited.hasCapacity.mockResolvedValue(false);
    expect(await sendPlatformMailWithDependencies(input, limited)).toEqual({ ok: false, reason: 'rate_limited' });
    expect(limited.createMessage).not.toHaveBeenCalled();
  });

  it('marks the created message failed when Mail queue submission fails', async () => {
    const dependencies = makeDependencies();
    dependencies.enqueue.mockRejectedValue(new Error('queue unavailable'));

    const result = await sendPlatformMailWithDependencies(input, dependencies);

    expect(result).toEqual({ ok: false, reason: 'queue_failed' });
    expect(dependencies.setMessageStatus).toHaveBeenCalledWith('message-1', 'failed');
  });
});
