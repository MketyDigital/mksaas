import Link from 'next/link';

import { Button } from '@/shared/components/ui';

import type { PlatformNavigationItemInput, PlatformSiteSettingsInput } from '../../schemas';

interface MketyPublicHeaderProps {
  settings: PlatformSiteSettingsInput;
  navigation: PlatformNavigationItemInput[];
}

function PublicNavLink({ item, className }: { item: PlatformNavigationItemInput; className?: string }) {
  const externalProps = item.external ? { target: '_blank' as const, rel: 'noreferrer noopener' } : {};

  return (
    <Link href={item.href} className={className} {...externalProps}>
      {item.label}
    </Link>
  );
}

export function MketyPublicHeader({ settings, navigation }: MketyPublicHeaderProps) {
  const headerItems = navigation.filter((item) => item.area === 'header' && item.enabled !== false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container mx-auto flex min-h-16 items-center justify-between gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight" aria-label={settings.brandName}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-hidden="true">
            M
          </span>
          <span>{settings.brandName}</span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-5 text-sm font-medium text-muted-foreground lg:flex">
          {headerItems.map((item) => (
            <PublicNavLink
              key={`${item.label}-${item.href}`}
              item={item}
              className="transition-colors hover:text-foreground focus-visible:text-foreground"
            />
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Button asChild variant="ghost">
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild className="rounded-xl">
            <Link href="/create-workspace">Get Started</Link>
          </Button>
        </div>

        <details className="relative lg:hidden">
          <summary className="cursor-pointer list-none rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Menu
          </summary>
          <div className="absolute right-0 mt-2 w-72 rounded-2xl border bg-background p-3 shadow-xl">
            <nav aria-label="Mobile navigation" className="grid gap-1">
              {headerItems.map((item) => (
                <PublicNavLink
                  key={`mobile-${item.label}-${item.href}`}
                  item={item}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                />
              ))}
            </nav>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/create-workspace">Get Started</Link>
              </Button>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
