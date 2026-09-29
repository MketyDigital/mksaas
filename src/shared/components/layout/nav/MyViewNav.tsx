'use client';

import { Bot, Boxes, CreditCard, Github, Globe, LayoutDashboard, Mail, User, WalletCards } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { SidebarNavItem } from '../SidebarNavItem';
import { SidebarSection } from '../SidebarSection';
import { SidebarSeparator } from '../SidebarSeparator';

interface MyViewNavProps {
  basePath: string;
  onItemClick?: () => void;
  hasMailAccess?: boolean;
  hasEnterpriseAiAccess?: boolean;
}

export function MyViewNav({ basePath, onItemClick, hasMailAccess = false, hasEnterpriseAiAccess = false }: MyViewNavProps) {
  const t = useTranslations('nav');

  return (
    <>
      <SidebarNavItem href={basePath} label={t('dashboard')} icon={LayoutDashboard} iconTint="primary" exact onClick={onItemClick} />
      <SidebarNavItem href={`${basePath}/assistant`} label={t('assistant')} icon={Bot} iconTint="assistant" onClick={onItemClick} />
      <SidebarNavItem href={`${basePath}/projects`} label="Projects" icon={Boxes} iconTint="primary" onClick={onItemClick} />
      <SidebarNavItem href={`${basePath}/wallet`} label="Usage & Credits" icon={WalletCards} iconTint="primary" onClick={onItemClick} />
      <SidebarNavItem href={`${basePath}/billing`} label="Plan & Billing" icon={CreditCard} iconTint="primary" onClick={onItemClick} />
      {hasMailAccess ? <SidebarNavItem href={`${basePath}/mail`} label="Mkety Mail" icon={Mail} iconTint="primary" onClick={onItemClick} /> : null}
      {hasEnterpriseAiAccess ? <SidebarNavItem href={`${basePath}/enterprise-ai`} label="Enterprise AI" icon={Bot} iconTint="assistant" onClick={onItemClick} /> : null}

      <SidebarSeparator />

      <SidebarSection title={t('myProfile')} icon={<User className="h-4 w-4" />} variant="default">
        <SidebarNavItem href={`${basePath}/profile`} label={t('overview')} icon={User} exact onClick={onItemClick} />
      </SidebarSection>

      <SidebarSection title={t('integrations')} icon={<Globe className="h-4 w-4" />} variant="default">
        <SidebarNavItem href={`${basePath}/profile?tab=github`} label="GitHub" icon={Github} onClick={onItemClick} />
      </SidebarSection>
    </>
  );
}
