'use client';

import {
  BookOpen,
  Boxes,
  BriefcaseBusiness,
  CircleHelp,
  GraduationCap,
  House,
  Layers3,
  MoreHorizontal,
  Tags,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const primaryItems = [
  { label: 'Home', href: '/', icon: House },
  { label: 'Platform', href: '/platform', icon: Layers3 },
  { label: 'Academy', href: '/academy', icon: GraduationCap },
  { label: 'SolutionHub', href: '/solutions', icon: Boxes },
] as const;

const moreItems = [
  { label: 'Workspaces', href: '/workspaces', icon: Layers3 },
  { label: 'Pricing', href: '/pricing', icon: Tags },
  { label: 'Enterprise', href: '/enterprise', icon: BriefcaseBusiness },
  { label: 'Docs', href: '/docs', icon: BookOpen },
  { label: 'About', href: '/about', icon: UsersRound },
  { label: 'Contact', href: '/contact', icon: CircleHelp },
] as const;

function routeIsActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

const baseItemClass =
  'group flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-medium transition sm:px-3 sm:text-xs';
const activeItemClass =
  'bg-gradient-to-br from-violet-600/95 to-cyan-500/90 text-white shadow-lg shadow-violet-950/20';
const inactiveItemClass = 'text-muted-foreground hover:bg-muted/70 hover:text-foreground';

export function MketyPublicDock() {
  const pathname = usePathname() || '/';
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreItems.some((item) => routeIsActive(pathname, item.href));

  return (
    <nav
      aria-label="Mkety app navigation"
      className="fixed inset-x-2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] mx-auto w-[calc(100%-1rem)] max-w-[680px] rounded-[1.6rem] border border-border/80 bg-background/88 p-1.5 shadow-2xl shadow-violet-950/15 backdrop-blur-xl supports-[backdrop-filter]:bg-background/76"
    >
      <div className="grid grid-cols-5 gap-1">
        {primaryItems.map((item) => {
          const active = routeIsActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`${baseItemClass} ${active ? activeItemClass : inactiveItemClass}`}
            >
              <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}

        <div className="relative min-w-0">
          {moreOpen ? (
            <div
              id="mkety-public-more-menu"
              className="absolute bottom-[calc(100%+0.7rem)] right-0 w-56 overflow-hidden rounded-2xl border border-border/80 bg-background/96 p-2 shadow-2xl backdrop-blur-xl"
            >
              <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                More from Mkety
              </p>
              <div className="grid gap-1">
                {moreItems.map((item) => {
                  const active = routeIsActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                        active
                          ? 'bg-gradient-to-r from-violet-600/15 to-cyan-500/15 font-semibold text-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            aria-label="More"
            aria-expanded={moreOpen}
            aria-controls="mkety-public-more-menu"
            data-active={moreActive ? 'true' : 'false'}
            onClick={() => setMoreOpen((value) => !value)}
            className={`${baseItemClass} w-full ${moreActive || moreOpen ? activeItemClass : inactiveItemClass}`}
          >
            <MoreHorizontal className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
            <span>More</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
