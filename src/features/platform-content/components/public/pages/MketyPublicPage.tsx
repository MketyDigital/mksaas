import { Grid3X3, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

import type {
  PlatformFooterGroupInput,
  PlatformNavigationItemInput,
  PlatformSiteSettingsInput,
} from '../../../schemas';
import type { MketyPublishedPublicPage } from '../../../server/public-page';
import { MketyPublicShell } from '../MketyPublicShell';

interface MketyPublicPageProps {
  page: MketyPublishedPublicPage;
  settings: PlatformSiteSettingsInput;
  navigation: PlatformNavigationItemInput[];
  footerGroups: PlatformFooterGroupInput[];
  featuredContent?: ReactNode;
}

export function MketyPublicPage({ page, settings, navigation, footerGroups, featuredContent }: MketyPublicPageProps) {
  return (
    <MketyPublicShell settings={settings} navigation={navigation} footerGroups={footerGroups}>
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/[0.12] via-background to-background px-4 py-16 lg:py-24">
        <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="container relative mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">{page.eyebrow}</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">{page.headline}</h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">{page.intro}</p>
            </div>
            <div className="rounded-[1.75rem] border border-primary/15 bg-card/75 p-3 shadow-lg backdrop-blur">
              <div className="rounded-2xl border bg-background/80 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Grid3X3 className="h-5 w-5" />
                  </span>
                  <span className="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Mkety public surface
                  </span>
                </div>
                <p className="mt-8 text-sm font-semibold">{page.eyebrow}</p>
                <div className="mt-3 grid grid-cols-3 gap-2" aria-hidden="true">
                  <span className="h-2 rounded-full bg-primary/70" />
                  <span className="h-2 rounded-full bg-primary/30" />
                  <span className="h-2 rounded-full bg-muted" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {featuredContent}

      <div className="px-4 py-10 md:py-14">
        <div className="container mx-auto space-y-5">
          {page.sections.map((section, index) => (
            <section
              key={`${page.slug}-${section.eyebrow}-${index}`}
              className={
                index % 2 === 1
                  ? 'overflow-hidden rounded-[2rem] border bg-muted/25 p-6 md:p-10'
                  : 'overflow-hidden rounded-[2rem] border bg-card/55 p-6 shadow-sm md:p-10'
              }
            >
              <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">{section.eyebrow}</p>
                  <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{section.title}</h2>
                  <p className="mt-4 leading-7 text-muted-foreground">{section.description}</p>
                  {section.cta && (
                    <Button asChild className="mt-6 rounded-xl">
                      <Link href={section.cta.href}>{section.cta.label}</Link>
                    </Button>
                  )}
                </div>

                {section.items.length > 0 && (
                  <div className="grid auto-rows-[minmax(10rem,auto)] gap-4 md:grid-cols-2">
                    {section.items.map((item, itemIndex) => (
                      <Card
                        key={item.key}
                        className={
                          itemIndex === 0 && section.items.length > 2
                            ? 'rounded-3xl border-primary/15 bg-background/85 md:row-span-2'
                            : 'rounded-3xl border-primary/10 bg-background/85'
                        }
                      >
                        <CardHeader>
                          <div className="mb-5 flex items-start justify-between gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <Sparkles className="h-4 w-4" />
                            </span>
                            {item.badge && (
                              <span className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-primary">
                                {item.badge}
                              </span>
                            )}
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
            </section>
          ))}
        </div>
      </div>
    </MketyPublicShell>
  );
}
