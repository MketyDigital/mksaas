import Link from 'next/link';

import { Button } from '@/shared/components/ui';

import { dedupePublicNavigation } from './public-navigation';
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
  const headerItems = dedupePublicNavigation(navigation.filter((item) => item.area === 'header'));
  const utilityItems = headerItems.filter((item) => item.href === '/docs').slice(0, 1);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex min-h-16 items-center justify-between gap-3 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 font-bold tracking-tight"
          aria-label={settings.brandName}
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white shadow-sm shadow-violet-950/15"
            aria-hidden="true"
          >
            M
          </span>
          <span>{settings.brandName}</span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {utilityItems.map((item) => (
            <PublicNavLink
              key={`${item.label}-${item.href}`}
              item={item}
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:inline-flex"
            />
          ))}
          <Button asChild variant="ghost" className="px-3">
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild className="hidden rounded-xl sm:inline-flex">
            <Link href="/create-workspace">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
