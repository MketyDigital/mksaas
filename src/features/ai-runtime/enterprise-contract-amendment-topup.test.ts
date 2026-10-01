/** @jest-environment node */

import { readFile } from 'node:fs/promises';

describe('Enterprise AI contract amendment and top-up journey', () => {
  it('cancels superseded unpaid checkout state when a contract is amended', async () => {
    const contracts = await readFile('src/features/ai-runtime/server/enterprise-contracts.ts', 'utf8');

    expect(contracts).toContain("eq(billingSubscriptions.status, 'pending_payment')");
    expect(contracts).toContain("cancellationReason: 'enterprise_contract_superseded_before_payment'");
    expect(contracts).toContain("inArray(billingCheckouts.status, ['created', 'redirected', 'awaiting_confirmation'])");
  });

  it('keeps paid full-period contracts eligible for verified extra-credit top-ups', async () => {
    const contracts = await readFile('src/features/ai-runtime/server/enterprise-contracts.ts', 'utf8');
    const settlement = await readFile('src/features/ai-runtime/server/enterprise-funding-settlement.ts', 'utf8');
    const page = await readFile('src/app/app/[tenant]/enterprise-ai/page.tsx', 'utf8');

    expect(contracts).toContain('fullPeriodTopUp');
    expect(contracts).toContain('historicalPolicy');
    expect(contracts).toContain('historicalPeriod');
    expect(contracts).toContain('paidThroughFuture.planVersionId !== contract.planVersionId');
    expect(contracts).toContain("purpose: partialFunding || fullPeriodTopUp ? 'enterprise_ai_funding' : 'subscription'");
    expect(settlement).toContain("policy.fundingMode === 'prepaid_partial'");
    expect(page).toContain('Buy extra credits');
    expect(page).toContain('Top up beyond your included monthly credits');
  });

  it('exposes durable customer agreement sharing and amendment controls in Ops', async () => {
    const page = await readFile('src/app/ops/[tenant]/platform-control/[module]/page.tsx', 'utf8');

    expect(page).toContain('Customer agreement link');
    expect(page).toContain('https://app.mkety.com/app/');
    expect(page).toContain('Email agreement link');
    expect(page).toContain('Amend contract');
    expect(page).toContain('Save amended version');
  });
});
