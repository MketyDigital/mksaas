import { ArrowRight, BookOpen, Bot, CheckCircle2, Cloud, GraduationCap, Layers3, LockKeyhole, Rocket, Shield, Workflow } from 'lucide-react';
import Link from 'next/link';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

import type { PlatformFaqItemInput, PlatformFooterGroupInput, PlatformHeroSectionInput, PlatformNavigationItemInput, PlatformPricingPlanInput, PlatformSiteSettingsInput, PlatformWorkspaceSectionInput } from '../../schemas';
import { MketyPublicShell } from './MketyPublicShell';

interface MketyHomePageProps {
  content: {
    settings: PlatformSiteSettingsInput;
    navigation: PlatformNavigationItemInput[];
    hero: PlatformHeroSectionInput;
    workspaces: PlatformWorkspaceSectionInput;
    pricingPlans: PlatformPricingPlanInput[];
    faqItems: PlatformFaqItemInput[];
    footerGroups: PlatformFooterGroupInput[];
  };
}

const workspaceIcons = [Bot, Workflow, Rocket, Layers3];

export function MketyHomePage({ content }: MketyHomePageProps) {
  const { settings, hero, navigation, workspaces, pricingPlans, faqItems, footerGroups } = content;

  return (
    <MketyPublicShell settings={settings} navigation={navigation} footerGroups={footerGroups}>
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="container mx-auto grid gap-12 px-4 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border bg-background/80 px-4 py-2 text-sm font-medium text-primary shadow-sm">
              <Shield className="h-4 w-4" />
              {hero.badge}
            </div>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">{hero.headline}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">{hero.subheadline}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-xl">
                <Link href={hero.primaryCta.href}>
                  {hero.primaryCta.label}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl">
                <Link href={hero.secondaryCta.href}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  {hero.secondaryCta.label}
                </Link>
              </Button>
            </div>
          </div>

          <Card className="rounded-3xl border-primary/20 bg-card/80 shadow-2xl backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-primary" />
                Mkety operating system
              </CardTitle>
              <CardDescription>Platform, Workspaces, SolutionHub, Docs, billing, and operations in one model.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {hero.previewItems.map((item) => (
                <div key={item.label} className="rounded-2xl border bg-background/80 p-4">
                  <p className="font-semibold">{item.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="platform" className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Platform</p>
          <h2 className="mt-3 text-3xl font-bold md:text-4xl">Build, automate, deploy, integrate, and operate.</h2>
          <p className="mt-4 text-muted-foreground">
            Mkety connects projects, teams, AI, automation, deployments, domains, SolutionHub, usage, credits, billing, and administration without turning the product into an AI-only tool.
          </p>
        </div>
      </section>

      <section id="workspaces" className="bg-muted/30 px-4 py-20">
        <div className="container mx-auto">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">{workspaces.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">{workspaces.title}</h2>
            {workspaces.description && <p className="mt-4 text-muted-foreground">{workspaces.description}</p>}
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {workspaces.items.map((item, index) => {
              const Icon = workspaceIcons[index] ?? Layers3;
              return (
                <Card key={item.key} className="rounded-2xl transition hover:-translate-y-1 hover:shadow-lg">
                  <CardHeader>
                    <div className="mb-4 flex items-center justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      {item.badge && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{item.badge}</span>}
                    </div>
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                  {item.href && (
                    <CardContent>
                      <Link href={item.href} className="text-sm font-medium text-primary hover:underline">
                        Explore {item.title} →
                      </Link>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="solutions" className="container mx-auto grid gap-8 px-4 py-20 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-3xl">SolutionHub</CardTitle>
            <CardDescription>
              Ready-made solutions, workflows, agents, applications, deployment templates, business automations, and industry blueprints that can be launched into Mkety workspaces.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card id="academy" className="rounded-2xl">
          <CardHeader>
            <GraduationCap className="mb-4 h-8 w-8 text-primary" />
            <CardTitle>Mkety Academy</CardTitle>
            <CardDescription>Practical technology training, AI workshops, business implementation courses, certifications, and enterprise enablement.</CardDescription>
          </CardHeader>
        </Card>
      </section>

      <section id="enterprise" className="bg-muted/30 px-4 py-20">
        <div className="container mx-auto grid gap-6 lg:grid-cols-3">
          <Card className="rounded-2xl lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-3xl">Enterprise and customer solutions</CardTitle>
              <CardDescription>
                Mkety can deliver custom systems, specialized implementations, Trading infrastructure, mklms-style customer projects, integrations, and managed platform support while keeping these solutions separated from normal self-service workspaces.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="rounded-2xl border-primary/30">
            <CardHeader>
              <LockKeyhole className="mb-4 h-8 w-8 text-primary" />
              <CardTitle>Controlled access</CardTitle>
              <CardDescription>Identity, authorization, entitlements, billing, deployment, and security remain code-controlled and audit-protected.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section id="pricing" className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Plans, Pricing, Credits, Usage</p>
          <h2 className="mt-3 text-3xl font-bold md:text-4xl">Clear plans with controlled entitlements.</h2>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {pricingPlans.map((plan) => (
            <Card key={plan.key} className={plan.highlighted ? 'rounded-2xl border-primary shadow-lg' : 'rounded-2xl'}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <p className="text-2xl font-bold">{plan.priceLabel}</p>
                {plan.billingLabel && <CardDescription>{plan.billingLabel}</CardDescription>}
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-6 w-full rounded-xl" variant={plan.highlighted ? 'default' : 'outline'}>
                  <Link href={plan.ctaHref}>{plan.ctaLabel}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-muted/30 px-4 py-20">
        <div className="container mx-auto grid gap-4 md:grid-cols-3">
          {faqItems.map((item) => (
            <Card key={item.question} className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">{item.question}</CardTitle>
                <CardDescription>{item.answer}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </MketyPublicShell>
  );
}
