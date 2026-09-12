import type { ReactNode } from 'react';

import { MketyPublicAssistant } from '@/features/public-assistant/components/MketyPublicAssistant';

import { MketyPublicFooter } from './MketyPublicFooter';
import { MketyPublicHeader } from './MketyPublicHeader';
import type { PlatformFooterGroupInput, PlatformNavigationItemInput, PlatformSiteSettingsInput } from '../../schemas';

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
      <MketyPublicAssistant />
    </div>
  );
}
