import Link from 'next/link';

import type { PlatformFooterGroupInput, PlatformSiteSettingsInput } from '../../schemas';

interface MketyPublicFooterProps {
  settings: PlatformSiteSettingsInput;
  footerGroups: PlatformFooterGroupInput[];
}

export function MketyPublicFooter({ settings, footerGroups }: MketyPublicFooterProps) {
  return (
    <footer className="border-t bg-background px-4 py-10">
      <div className="container mx-auto grid gap-8 md:grid-cols-[1fr_2fr]">
        <div>
          <p className="font-bold tracking-tight">{settings.brandName}</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Technology platform for building, automating, deploying, integrating, and operating modern business systems.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {footerGroups.map((group) => (
            <div key={group.title}>
              <p className="font-semibold">{group.title}</p>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                {group.links.map((link) => (
                  <Link key={`${group.title}-${link.href}`} href={link.href} className="hover:text-foreground">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {settings.legalLinks.length > 0 && (
            <div>
              <p className="font-semibold">Legal</p>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                {settings.legalLinks.map((link) => (
                  <Link key={`${link.label}-${link.href}`} href={link.href} className="hover:text-foreground">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="container mx-auto mt-8 border-t pt-6 text-xs text-muted-foreground">
        © {new Date().getUTCFullYear()} {settings.brandName}. All rights reserved.
      </div>
    </footer>
  );
}
