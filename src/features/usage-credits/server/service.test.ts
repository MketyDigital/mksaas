import type { ConsumeCreditsInput, CreditBalance, GrantCreditsInput } from '../types';
import { USAGE_CREDIT_ERROR_CODES } from '../types';
import type {
  CreditLedgerRecord,
  StoredUsageRecord,
  UsageCreditSource,
  UsageCreditTransaction,
} from './source';
import { createUsageCreditService } from './service';

class FakeUsageCreditSource implements UsageCreditSource {
  private accounts = new Map<string, CreditBalance>();
  private ledger: CreditLedgerRecord[] = [];
  private usage: StoredUsageRecord[] = [];
  private queue = Promise.resolve();
  private sequence = 0;

  async transaction<T>(work: (tx: UsageCreditTransaction) => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    const accountSnapshot = new Map(this.accounts);
    const ledgerSnapshot = [...this.ledger];
    const usageSnapshot = [...this.usage];

    const tx: UsageCreditTransaction = {
      findLedgerByIdempotency: async (tenantId, idempotencyKey) =>
        this.ledger.find((entry) => entry.tenantId === tenantId && entry.idempotencyKey === idempotencyKey) ?? null,
      findUsageByIdempotency: async (tenantId, idempotencyKey) =>
        this.usage.find((event) => event.tenantId === tenantId && event.idempotencyKey === idempotencyKey) ?? null,
      getCreditBalance: async (tenantId) => this.accounts.get(tenantId) ?? null,
      applyGrant: async (tenantId, credits) => {
        const current = this.accounts.get(tenantId) ?? {
          tenantId,
          availableCredits: 0n,
          lifetimeGranted: 0n,
          lifetimeConsumed: 0n,
        };
        const next = {
          ...current,
          availableCredits: current.availableCredits + credits,
          lifetimeGranted: current.lifetimeGranted + credits,
        };
        this.accounts.set(tenantId, next);
        return next;
      },
      applyDebit: async (tenantId, credits) => {
        const current = this.accounts.get(tenantId);
        if (!current || current.availableCredits < credits) return null;
        const next = {
          ...current,
          availableCredits: current.availableCredits - credits,
          lifetimeConsumed: current.lifetimeConsumed + credits,
        };
        this.accounts.set(tenantId, next);
        return next;
      },
      insertUsage: async (input) => {
        const event: StoredUsageRecord = { ...input, id: `usage-${++this.sequence}` };
        this.usage.push(event);
        return event;
      },
      insertLedger: async (input) => {
        const entry: CreditLedgerRecord = { ...input, id: `ledger-${++this.sequence}` };
        this.ledger.push(entry);
        return entry;
      },
    };

    try {
      return await work(tx);
    } catch (error) {
      this.accounts = accountSnapshot;
      this.ledger = ledgerSnapshot;
      this.usage = usageSnapshot;
      throw error;
    } finally {
      release();
    }
  }

  async getCreditBalance(tenantId: string) {
    return this.accounts.get(tenantId) ?? null;
  }

  async getTenantUsage(tenantId: string) {
    return this.usage.filter((event) => event.tenantId === tenantId);
  }

  async getCreditLedger(tenantId: string) {
    return this.ledger.filter((entry) => entry.tenantId === tenantId);
  }
}

const grant = (overrides: Partial<GrantCreditsInput> = {}): GrantCreditsInput => ({
  tenantId: 'tenant-a',
  credits: 100n,
  idempotencyKey: 'grant-1',
  entryType: 'manual_grant',
  source: 'test',
  reason: 'seed',
  ...overrides,
});

const consume = (overrides: Partial<ConsumeCreditsInput> = {}): ConsumeCreditsInput => ({
  tenantId: 'tenant-a',
  meter: 'automation.run',
  quantity: 1n,
  credits: 80n,
  idempotencyKey: 'consume-1',
  source: 'test',
  ...overrides,
});

describe('usage credit service', () => {
  it('grants credits idempotently and updates the projection once', async () => {
    const service = createUsageCreditService(new FakeUsageCreditSource());

    const first = await service.grantCredits(grant());
    const replay = await service.grantCredits(grant());

    expect(replay).toEqual(first);
    await expect(service.getCreditBalance('tenant-a')).resolves.toMatchObject({
      availableCredits: 100n,
      lifetimeGranted: 100n,
    });
  });

  it('rejects conflicting reuse of a grant idempotency key', async () => {
    const service = createUsageCreditService(new FakeUsageCreditSource());
    await service.grantCredits(grant());

    await expect(service.grantCredits(grant({ credits: 101n }))).rejects.toMatchObject({
      code: USAGE_CREDIT_ERROR_CODES.idempotencyConflict,
    });
  });

  it('consumes credits exactly once and records immutable usage and ledger history', async () => {
    const source = new FakeUsageCreditSource();
    const service = createUsageCreditService(source);
    await service.grantCredits(grant());

    const first = await service.consumeCredits(consume());
    const replay = await service.consumeCredits(consume());

    expect(replay).toEqual(first);
    expect(first.usage).toMatchObject({ meterKey: 'automation.run', quantity: 1n, creditsCharged: 80n });
    await expect(service.getCreditBalance('tenant-a')).resolves.toMatchObject({
      availableCredits: 20n,
      lifetimeConsumed: 80n,
    });
    await expect(service.getTenantUsage('tenant-a')).resolves.toHaveLength(1);
    await expect(service.getCreditLedger('tenant-a')).resolves.toHaveLength(2);
  });

  it('rejects insufficient credits without leaving partial usage or ledger writes', async () => {
    const source = new FakeUsageCreditSource();
    const service = createUsageCreditService(source);
    await service.grantCredits(grant({ credits: 50n }));

    await expect(service.consumeCredits(consume({ credits: 51n }))).rejects.toMatchObject({
      code: USAGE_CREDIT_ERROR_CODES.insufficientCredits,
    });
    await expect(service.getTenantUsage('tenant-a')).resolves.toHaveLength(0);
    await expect(service.getCreditLedger('tenant-a')).resolves.toHaveLength(1);
  });

  it('isolates tenant balances, usage, ledger, and idempotency keys', async () => {
    const source = new FakeUsageCreditSource();
    const service = createUsageCreditService(source);
    await service.grantCredits(grant());
    await service.grantCredits(grant({ tenantId: 'tenant-b' }));
    await service.consumeCredits(consume());

    await expect(service.getTenantUsage('tenant-b')).resolves.toHaveLength(0);
    await expect(service.getCreditBalance('tenant-b')).resolves.toMatchObject({ availableCredits: 100n });
    await expect(service.getCreditLedger('tenant-b')).resolves.toHaveLength(1);
  });

  it('prevents two concurrent debits from spending the same credits', async () => {
    const source = new FakeUsageCreditSource();
    const service = createUsageCreditService(source);
    await service.grantCredits(grant({ credits: 100n }));

    const results = await Promise.allSettled([
      service.consumeCredits(consume({ idempotencyKey: 'consume-a', credits: 80n })),
      service.consumeCredits(consume({ idempotencyKey: 'consume-b', credits: 80n })),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(service.getCreditBalance('tenant-a')).resolves.toMatchObject({ availableCredits: 20n });
  });
});
