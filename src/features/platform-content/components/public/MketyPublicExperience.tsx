'use client';

import { Bot, Code2, GraduationCap, LayoutGrid, Megaphone, Network, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { cn } from '@/shared/lib/utils';

export interface MketyShowcaseItem {
  key: string;
  title: string;
  description: string;
  href?: string | null;
  badge?: string | null;
}

export interface MketyShowcaseGroup {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  description?: string | null;
  href: string;
  items: MketyShowcaseItem[];
}

interface MketyProductShowcaseProps {
  groups: MketyShowcaseGroup[];
}

const showcaseIcons = [Bot, Network, LayoutGrid, Code2];

export function MketyProductShowcase({ groups }: MketyProductShowcaseProps) {
  const [activeId, setActiveId] = useState(groups[0]?.id ?? '');
  const activeGroup = groups.find((group) => group.id === activeId) ?? groups[0];

  if (!activeGroup) return null;

  return (
    <section className="px-4 py-10 md:py-16" aria-label="Mkety product experience">
      <div className="container mx-auto">
        <div className="overflow-hidden rounded-[2rem] border border-primary/15 bg-card/75 shadow-[0_24px_80px_-32px_hsl(var(--primary)/0.35)] backdrop-blur-xl">
          <div className="grid lg:grid-cols-[15rem_minmax(0,1fr)]">
            <div className="border-b border-border/60 bg-muted/20 p-4 lg:border-b-0 lg:border-r lg:p-5">
              <div className="mb-4 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_16px_hsl(var(--primary))]" />
                Mkety OS
              </div>
              <div
                role="tablist"
                aria-label="Explore Mkety"
                className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible"
              >
                {groups.map((group, index) => {
                  const Icon = showcaseIcons[index] ?? LayoutGrid;
                  const selected = group.id === activeGroup.id;
                  return (
                    <button
                      key={group.id}
                      id={`mkety-showcase-tab-${group.id}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls={`mkety-showcase-panel-${group.id}`}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => setActiveId(group.id)}
                      className={cn(
                        'flex min-w-fit items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition motion-reduce:transition-none lg:w-full',
                        selected
                          ? 'border-primary/25 bg-background text-foreground shadow-sm'
                          : 'border-transparent text-muted-foreground hover:border-border hover:bg-background/60 hover:text-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-xl',
                          selected ? 'bg-primary text-primary-foreground' : 'bg-muted',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      {group.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              id={`mkety-showcase-panel-${activeGroup.id}`}
              role="tabpanel"
              aria-labelledby={`mkety-showcase-tab-${activeGroup.id}`}
              className="relative min-w-0 p-5 md:p-8"
            >
              <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative grid gap-7 xl:grid-cols-[0.75fr_1.25fr]">
                <div className="flex flex-col justify-between rounded-3xl border bg-background/70 p-6 shadow-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                      {activeGroup.eyebrow}
                    </p>
                    <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">{activeGroup.title}</h2>
                    {activeGroup.description && (
                      <p className="mt-4 leading-7 text-muted-foreground">{activeGroup.description}</p>
                    )}
                  </div>
                  <Link
                    href={activeGroup.href}
                    className="mt-8 inline-flex w-fit items-center gap-2 text-sm font-semibold text-primary hover:underline"
                  >
                    Open {activeGroup.label} <span aria-hidden>→</span>
                  </Link>
                </div>

                <div className="grid auto-rows-[minmax(9rem,auto)] gap-3 sm:grid-cols-2">
                  {activeGroup.items.slice(0, 4).map((item, index) => {
                    const Icon = showcaseIcons[index] ?? LayoutGrid;
                    return (
                      <article
                        key={item.key}
                        className={cn(
                          'group relative overflow-hidden rounded-3xl border bg-background/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none',
                          index === 0 && activeGroup.items.length > 2 ? 'sm:row-span-2' : '',
                        )}
                      >
                        <div className="mb-8 flex items-start justify-between gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </span>
                          {item.badge && (
                            <span className="rounded-full border bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                        {item.href && (
                          <Link
                            href={item.href}
                            className="absolute inset-0 rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                          >
                            <span className="sr-only">Explore {item.title}</span>
                          </Link>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const academyHubs = [
  {
    title: 'Web & App Engineering',
    description:
      'Practical screen sessions with React, Next.js, mobile application building, and modern deployment workflows.',
    icon: Code2,
  },
  {
    title: 'Trading Masterclass',
    description:
      'Live chart study, strategy reviews, risk management, market psychology, and execution-focused learning.',
    icon: TrendingUp,
  },
  {
    title: 'Digital Funnel & Marketing',
    description:
      'Build conversion-focused campaigns, social advertising systems, funnels, and measurable digital growth workflows.',
    icon: Megaphone,
  },
  {
    title: 'AI & Automation Lab',
    description: 'Build practical AI agents, prompt workflows, API connections, webhooks, and Mkety Flow automations.',
    icon: Bot,
  },
  {
    title: 'Certified Digital Skills',
    description:
      'Structured practical programs, collaborative projects, mentorship, and certification through the Mkety Academy ecosystem.',
    icon: GraduationCap,
  },
] as const;

export function MketyAcademyHubSection() {
  return (
    <section id="our-hubs" className="px-4 py-16 md:py-20">
      <div className="container mx-auto">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Mkety Academy Hub</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">At Our Hubs</h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              Immersive, hands-on learning where technology meets community. Build, practise, review, and learn with
              real workflows instead of passive theory.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary" /> Practical modules
          </span>
        </div>

        <div className="-mx-4 mt-9 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-5 [scrollbar-width:thin] md:mx-0 md:px-0">
          {academyHubs.map((hub, index) => {
            const Icon = hub.icon;
            return (
              <article
                key={hub.title}
                className="group relative flex min-h-72 min-w-[82vw] snap-center flex-col justify-between overflow-hidden rounded-[1.75rem] border border-primary/15 bg-card/80 p-6 shadow-sm sm:min-w-[22rem]"
              >
                <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-primary/10 blur-2xl transition group-hover:bg-primary/15 motion-reduce:transition-none" />
                <div className="relative">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-background text-primary shadow-sm">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-full border bg-background/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      Module {index + 1}
                    </span>
                  </div>
                  <div className="mt-16">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Mkety Academy Hub</p>
                    <h3 className="mt-2 text-xl font-bold">{hub.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{hub.description}</p>
                  </div>
                </div>
                <div className="relative mt-6 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${38 + index * 12}%` }} />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
