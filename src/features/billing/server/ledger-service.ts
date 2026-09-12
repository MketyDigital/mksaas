export type LedgerEntryType = 'charge' | 'payment' | 'credit' | 'debit' | 'waiver' | 'reversal';

export interface LedgerEntry {
  id: string;
  tenantId: string;
  subscriptionId: string | null;
  billingPeriodId: string | null;
  settlementId: string | null;
  entryType: LedgerEntryType;
  amountMinor: bigint;
  currency: string;
  reversalOfEntryId: string | null;
  reference: string | null;
}

export type NewLedgerEntry = Omit<LedgerEntry, 'id'>;

export interface BillingLedgerRepository {
  append(input: NewLedgerEntry): Promise<LedgerEntry>;
  findById(tenantId: string, entryId: string): Promise<LedgerEntry | null>;
}

export async function appendLedgerEntry(
  repository: BillingLedgerRepository,
  input: NewLedgerEntry,
): Promise<LedgerEntry> {
  return repository.append(input);
}

export async function reverseLedgerEntry(
  repository: BillingLedgerRepository,
  originalId: string,
  reason: string,
  context: { tenantId: string },
): Promise<LedgerEntry> {
  const normalizedReason = reason.trim();
  if (!normalizedReason) {
    throw new Error('Ledger reversal reason is required.');
  }

  const original = await repository.findById(context.tenantId, originalId);
  if (!original) {
    throw new Error('Ledger entry not found for tenant.');
  }

  if (original.entryType === 'reversal') {
    throw new Error('Reversal entries cannot be reversed directly.');
  }

  return repository.append({
    tenantId: original.tenantId,
    subscriptionId: original.subscriptionId,
    billingPeriodId: original.billingPeriodId,
    settlementId: original.settlementId,
    entryType: 'reversal',
    amountMinor: -original.amountMinor,
    currency: original.currency,
    reversalOfEntryId: original.id,
    reference: normalizedReason,
  });
}
