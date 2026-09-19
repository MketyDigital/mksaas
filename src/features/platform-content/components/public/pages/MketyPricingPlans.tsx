import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

import type { PlatformPricingPlanInput } from '../../../schemas';

export function MketyPricingPlans({ plans }: { plans: PlatformPricingPlanInput[] }) {
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
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.key} className={plan.highlighted ? 'rounded-2xl border-primary shadow-lg' : 'rounded-2xl'}>
              <CardHeader>
                <CardTitle>
                  <h3>{plan.name}</h3>
                </CardTitle>
                <p className="text-2xl font-bold">{plan.priceLabel}</p>
                {plan.billingLabel ? <CardDescription>{plan.billingLabel}</CardDescription> : null}
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
                  <Link href={plan.key === 'enterprise' ? '/?mketyAI=enterprise-sales' : plan.ctaHref}>{plan.ctaLabel}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
