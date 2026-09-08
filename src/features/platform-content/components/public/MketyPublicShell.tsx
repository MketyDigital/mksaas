import type { ReactNode } from 'react';

import type { PlatformFooterGroupInput, PlatformNavigationItemInput, PlatformSiteSettingsInput } from '../../schemas';
import { MketyPublicFooter } from './MketyPublicFooter';
import { MketyPublicHeader } from './MketyPublicHeader';

interface MketyPublicShellProps {
  settings: PlatformSiteSettingsInput;
  navigation: PlatformNavigationItemInput[];
  footerGroups: PlatformFooterGroupInput[];
  children: ReactNode;
}

export function MketyPublicShell({ settings, navigation, footerGroups, children }: MketyPublicShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MketyPublicHeader settings={settings} navigation={navigation} />
      <main>{children}</main>
      <MketyPublicFooter settings={settings} footerGroups={footerGroups} />
    </div>
  );
}
