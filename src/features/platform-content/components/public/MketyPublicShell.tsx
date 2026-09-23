import type { ReactNode } from 'react';

import { MketyPublicAssistant } from '@/features/public-assistant/components/MketyPublicAssistant';

import { MketyPublicDock } from './MketyPublicDock';
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
    <div className="min-h-screen bg-background pb-24 text-foreground sm:pb-28">
      <MketyPublicHeader settings={settings} navigation={navigation} />
      <MketyPublicAssistant
        logoUrl={settings.logoUrl}
        brandName={settings.brandName}
        supportEmail={settings.contactEmail}
        salesEmail={settings.salesEmail}
        telegramUrl={settings.telegramUrl}
        fallbackMessage={settings.publicAssistantFallbackMessage}
        leadCaptureEnabled={settings.publicAssistantLeadCaptureEnabled}
      />
      <main>{children}</main>
      <MketyPublicFooter settings={settings} footerGroups={footerGroups} />
      <MketyPublicDock />
    </div>
  );
}
