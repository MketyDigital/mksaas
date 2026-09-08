import Link from 'next/link';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

import type { MketyPublishedPublicPage } from '../../../server/public-page';
import type { PlatformFooterGroupInput, PlatformNavigationItemInput, PlatformSiteSettingsInput } from '../../../schemas';
import { MketyPublicShell } from '../MketyPublicShell';

interface MketyPublicPageProps {
  page: MketyPublishedPublicPage;
  settings: PlatformSiteSettingsInput;
  navigation: PlatformNavigationItemInput[];
  footerGroups: PlatformFooterGroupInput[];
}

export function MketyPublicPage({ page, settings, navigation, footerGroups }: MketyPublicPageProps) {
  return (
    <MketyPublicShell settings={settings} navigation={navigation} footerGroups={footerGroups}>
      <section className="border-b bg-gradient-to-b from-primary/10 via-background to-background px-4 py-20 lg:py-28">
        <div className="container mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">{page.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">{page.headline}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">{page.intro}</p>
        </div>
      </section>

      {page.sections.map((section, index) => (
        <section key={`${page.slug}-${section.eyebrow}-${index}`} className={index % 2 === 1 ? 'bg-muted/30 px-4 py-20' : 'px-4 py-20'}>
          <div className="container mx-auto">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">{section.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-bold md:text-4xl">{section.title}</h2>
              <p className="mt-4 leading-7 text-muted-foreground">{section.description}</p>
              {section.cta && (
                <Button asChild className="mt-6 rounded-xl">
                  <Link href={section.cta.href}>{section.cta.label}</Link>
                </Button>
              )}
            </div>

            {section.items.length > 0 && (
              <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {section.items.map((item) => (
                  <Card key={item.key} className="rounded-2xl">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle>{item.title}</CardTitle>
                        {item.badge && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{item.badge}</span>}
                      </div>
                      <CardDescription>{item.description}</CardDescription>
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
    </MketyPublicShell>
  );
}
