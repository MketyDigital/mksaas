'use client';

import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { getSelfServiceBillingQuote, isSelfServiceBillingPlanKey, SELF_SERVICE_BILLING_TERMS, type SelfServiceBillingTermKey } from '@/features/billing/catalog/self-service-plans';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

import type { PlatformPricingPlanInput } from '../../../schemas';

function formatUsd(amountMinor: bigint) {
  return '$' + (Number(amountMinor) / 100).toFixed(2);
}

function withTerm(href: string, term: SelfServiceBillingTermKey) {
  const join = href.includes('?') ? '&' : '?';
  return `${href}${join}term=${encodeURIComponent(term)}`;
}

export function MketyPricingPlans({ plans }: { plans: PlatformPricingPlanInput[] }) {
  const [termKey, setTermKey] = useState<SelfServiceBillingTermKey>('1m');
  return (
    <section className="border-b bg-muted/20 px-4 py-20">
      <div className="container mx-auto">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Mkety plans</p>
          <h2 className="mt-3 text-3xl font-bold md:text-4xl">Choose the access level that fits your work.</h2>
          <p className="mt-4 text-muted-foreground">
            Choose a plan for the capabilities you need. Usage and credits are shown separately where they apply, while Enterprise is tailored to your requirements.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {Object.values(SELF_SERVICE_BILLING_TERMS).map((term) => (
            <button
              key={term.key}
              type="button"
              onClick={() => setTermKey(term.key)}
              className={term.key === termKey ? 'rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground' : 'rounded-xl border px-4 py-2 text-sm font-semibold hover:border-primary/50'}
            >
              {term.label}{term.discountPercent ? ` · Save ${term.discountPercent}%` : ''}
            </button>
          ))}
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const quote = isSelfServiceBillingPlanKey(plan.key) ? getSelfServiceBillingQuote(plan.key, termKey) : null;
            return (
            <Card key={plan.key} className={plan.highlighted ? 'rounded-2xl border-primary shadow-lg' : 'rounded-2xl'}>
              <CardHeader>
                <CardTitle>
                  <h3>{plan.name}</h3>
                </CardTitle>
                <p
                  className="text-2xl font-bold"
                  data-plan-price={quote ? `${plan.key}:${formatUsd(quote.amountMinor)}` : undefined}
                >
                  {quote ? formatUsd(quote.amountMinor) : plan.priceLabel}
                </p>
                {quote ? (
                  <CardDescription>
                    total for {quote.term.months} month{quote.term.months === 1 ? '' : 's'}
                    {quote.term.discountPercent ? ` · ${formatUsd(quote.effectiveMonthlyMinor)}/mo effective` : ''}
                  </CardDescription>
                ) : plan.billingLabel ? <CardDescription>{plan.billingLabel}</CardDescription> : null}
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-6 w-full rounded-xl" variant={plan.highlighted ? 'default' : 'outline'}>
                  <Link href={quote ? withTerm(plan.ctaHref, termKey) : plan.ctaHref}>{plan.ctaLabel}</Link>
                </Button>
              </CardContent>
            </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
