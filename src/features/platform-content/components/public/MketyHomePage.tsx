import { ArrowRight, BookOpen, Bot, CheckCircle2, Cloud, Layers3, Rocket, Shield, Sparkles, Workflow } from 'lucide-react';
import Link from 'next/link';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

import type {
  PlatformAcademySectionInput,
  PlatformEnterpriseSectionInput,
  PlatformFaqItemInput,
  PlatformFooterGroupInput,
  PlatformHeroSectionInput,
  PlatformNavigationItemInput,
  PlatformOverviewSectionInput,
  PlatformPricingPlanInput,
  PlatformSiteSettingsInput,
  PlatformSolutionHubSectionInput,
  PlatformTrustSectionInput,
  PlatformWorkspaceSectionInput,
} from '../../schemas';
import { MketyProductShowcase, type MketyShowcaseGroup } from './MketyPublicExperience';
import { MketyPublicShell } from './MketyPublicShell';

interface MketyHomePageProps {
  content: {
    settings: PlatformSiteSettingsInput;
    navigation: PlatformNavigationItemInput[];
    hero: PlatformHeroSectionInput;
    platformOverview: PlatformOverviewSectionInput;
    workspaces: PlatformWorkspaceSectionInput;
    solutionHub: PlatformSolutionHubSectionInput;
    academy: PlatformAcademySectionInput;
    enterprise: PlatformEnterpriseSectionInput;
    trust: PlatformTrustSectionInput;
    pricingPlans: PlatformPricingPlanInput[];
    faqItems: PlatformFaqItemInput[];
    footerGroups: PlatformFooterGroupInput[];
  };
}

const workspaceIcons = [Bot, Workflow, Rocket, Layers3];

type ContentSection = PlatformOverviewSectionInput | PlatformSolutionHubSectionInput | PlatformAcademySectionInput | PlatformEnterpriseSectionInput | PlatformTrustSectionInput;

function PublicContentSection({ section, muted = false }: { section: ContentSection; muted?: boolean }) {
  return (
    <section className="px-4 py-12 md:py-16">
      <div className="container mx-auto">
        <div className={muted ? 'overflow-hidden rounded-[2rem] border bg-muted/25 p-6 md:p-10' : 'overflow-hidden rounded-[2rem] border bg-card/55 p-6 shadow-sm md:p-10'}>
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
            <div className="lg:sticky lg:top-24">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">{section.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{section.title}</h2>
              <p className="mt-4 leading-7 text-muted-foreground">{section.description}</p>
              {section.cta && (
                <Button asChild variant="outline" className="mt-6 rounded-xl">
                  <Link href={section.cta.href}>{section.cta.label}</Link>
                </Button>
              )}
            </div>

            {section.items.length > 0 && (
              <div className="grid auto-rows-[minmax(10rem,auto)] gap-4 md:grid-cols-2">
                {section.items.map((item, index) => (
                  <Card
                    key={item.key}
                    className={index === 0 && section.items.length > 2 ? 'rounded-3xl border-primary/15 bg-background/80 md:row-span-2' : 'rounded-3xl border-primary/10 bg-background/80'}
                  >
                    <CardHeader>
                      <div className="mb-5 flex items-start justify-between gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Sparkles className="h-4 w-4" />
                        </span>
                        {item.badge && <span className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-primary">{item.badge}</span>}
                      </div>
                      <CardTitle>{item.title}</CardTitle>
                      <CardDescription className="leading-6">{item.description}</CardDescription>
                    </CardHeader>
                    {item.href && (
                      <CardContent>
                        <Link href={item.href} className="text-sm font-medium text-primary hover:underline">
                          Learn more →
                        </Link>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function MketyHomePage({ content }: MketyHomePageProps) {
  const {
    settings,
    hero,
    navigation,
    platformOverview,
    workspaces,
    solutionHub,
    academy,
    enterprise,
    trust,
    pricingPlans,
    faqItems,
    footerGroups,
  } = content;

  const showcaseGroups: MketyShowcaseGroup[] = [
    {
      id: 'platform',
      label: 'Platform',
      eyebrow: platformOverview.eyebrow,
      title: platformOverview.title,
      description: platformOverview.description,
      href: '/platform',
      items: platformOverview.items,
    },
    {
      id: 'workspaces',
      label: 'Workspaces',
      eyebrow: workspaces.eyebrow,
      title: workspaces.title,
      description: workspaces.description,
      href: '/workspaces',
      items: workspaces.items,
    },
    {
      id: 'solutions',
      label: 'Solutions',
      eyebrow: solutionHub.eyebrow,
      title: solutionHub.title,
      description: solutionHub.description,
      href: '/solutions',
      items: solutionHub.items,
    },
    {
      id: 'academy',
      label: 'Academy',
      eyebrow: academy.eyebrow,
      title: academy.title,
      description: academy.description,
      href: '/academy',
      items: academy.items,
    },
  ];

  return (
    <MketyPublicShell settings={settings} navigation={navigation} footerGroups={footerGroups}>
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/[0.12] via-background to-background">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="container relative mx-auto grid gap-12 px-4 py-16 lg:grid-cols-[1fr_1fr] lg:py-24">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border bg-background/80 px-4 py-2 text-sm font-medium text-primary shadow-sm backdrop-blur">
              <Shield className="h-4 w-4" />
              {hero.badge}
            </div>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">{hero.headline}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">{hero.subheadline}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-xl">
                <Link href={hero.primaryCta.href}>
                  {hero.primaryCta.label}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl bg-background/70">
                <Link href={hero.secondaryCta.href}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  {hero.secondaryCta.label}
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl rounded-[2rem] border border-primary/20 bg-card/70 p-3 shadow-[0_32px_100px_-36px_hsl(var(--primary)/0.5)] backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between rounded-2xl border bg-background/80 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">Mkety Console</span>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">Public preview</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-3xl border bg-background/85 p-5 sm:row-span-2">
                <div className="flex items-center gap-2 text-primary">
                  <Cloud className="h-5 w-5" />
                  <span className="text-sm font-semibold">One operating system</span>
                </div>
                <p className="mt-3 text-xl font-bold">Build. Automate. Deploy. Operate.</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Platform capabilities become connected surfaces instead of disconnected tools.</p>
                <div className="mt-8 grid grid-cols-2 gap-2">
                  {['AI', 'Flow', 'Deploy', 'Solutions'].map((label) => (
                    <div key={label} className="rounded-2xl border bg-card p-3 text-xs font-semibold">
                      {label}
                    </div>
                  ))}
                </div>
              </div>
              {hero.previewItems.slice(0, 2).map((item, index) => (
                <div key={item.label} className="rounded-3xl border bg-background/85 p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">0{index + 1}</span>
                    <span className="h-2 w-2 rounded-full bg-primary/70" />
                  </div>
                  <p className="font-semibold">{item.label}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
            {hero.previewItems.length > 2 && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {hero.previewItems.slice(2, 4).map((item) => (
                  <div key={item.label} className="rounded-2xl border bg-background/70 px-4 py-3">
                    <p className="text-xs font-semibold">{item.label}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <MketyProductShowcase groups={showcaseGroups} />

      <div id="platform">
        <PublicContentSection section={platformOverview} />
      </div>

      <section id="workspaces" className="px-4 py-12 md:py-16">
        <div className="container mx-auto overflow-hidden rounded-[2rem] border bg-muted/20 p-6 md:p-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">{workspaces.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{workspaces.title}</h2>
            {workspaces.description && <p className="mt-4 text-muted-foreground">{workspaces.description}</p>}
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workspaces.items.map((item, index) => {
              const Icon = workspaceIcons[index] ?? Layers3;
              return (
                <Card key={item.key} className="rounded-3xl border-primary/10 bg-background/80 transition hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none">
                  <CardHeader>
                    <div className="mb-6 flex items-center justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      {item.badge && <span className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-primary">{item.badge}</span>}
                    </div>
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription className="leading-6">{item.description}</CardDescription>
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

      <div id="solutions">
        <PublicContentSection section={solutionHub} />
      </div>
      <div id="academy">
        <PublicContentSection section={academy} muted />
      </div>
      <div id="enterprise">
        <PublicContentSection section={enterprise} />
      </div>
      <PublicContentSection section={trust} muted />

      <section id="pricing" className="px-4 py-12 md:py-16">
        <div className="container mx-auto rounded-[2rem] border bg-card/60 p-6 shadow-sm md:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Plans, Pricing, Credits, Usage</p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">Clear plans with controlled entitlements.</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {pricingPlans.map((plan) => (
              <Card key={plan.key} className={plan.highlighted ? 'rounded-3xl border-primary bg-background shadow-lg' : 'rounded-3xl bg-background/80'}>
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
        </div>
      </section>

      <section className="px-4 py-12 md:py-16">
        <div className="container mx-auto grid gap-4 md:grid-cols-3">
          {faqItems.map((item) => (
            <Card key={item.question} className="rounded-3xl bg-muted/20">
              <CardHeader>
                <CardTitle className="text-base">{item.question}</CardTitle>
                <CardDescription className="leading-6">{item.answer}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </MketyPublicShell>
  );
}
