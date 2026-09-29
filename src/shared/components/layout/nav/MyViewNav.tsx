'use client';

import { Bot, Boxes, CreditCard, Github, Globe, Image, LayoutDashboard, Mail, PackageOpen, User, WalletCards } from 'lucide-react';
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

      <SidebarSection title="Workspace" icon={<Boxes className="h-4 w-4" />} variant="project">
        <SidebarNavItem href={`${basePath}/projects`} label="Projects" icon={Boxes} iconTint="project" onClick={onItemClick} />
        <SidebarNavItem href={`${basePath}/assistant`} label={t('assistant')} icon={Bot} iconTint="assistant" onClick={onItemClick} />
      </SidebarSection>

      <SidebarSection title="Products" icon={<PackageOpen className="h-4 w-4" />} variant="default">
        {hasEnterpriseAiAccess ? (
          <SidebarNavItem href={`${basePath}/enterprise-ai`} label="Enterprise AI" icon={Bot} iconTint="assistant" onClick={onItemClick} />
        ) : null}
        {hasMailAccess ? (
          <SidebarNavItem href={`${basePath}/mail`} label="Mkety Mail" icon={Mail} iconTint="primary" onClick={onItemClick} />
        ) : null}
        <SidebarNavItem href={`${basePath}/media`} label="Mkety Media" icon={Image} iconTint="primary" onClick={onItemClick} />
      </SidebarSection>

      <SidebarSection title="Account" icon={<CreditCard className="h-4 w-4" />} variant="settings">
        <SidebarNavItem href={`${basePath}/billing`} label="Plan & Billing" icon={CreditCard} iconTint="primary" onClick={onItemClick} />
        <SidebarNavItem href={`${basePath}/wallet`} label="Usage & Credits" icon={WalletCards} iconTint="primary" onClick={onItemClick} />
      </SidebarSection>

      <SidebarSeparator />

      <SidebarSection title={t('myProfile')} icon={<User className="h-4 w-4" />} variant="default">
        <SidebarNavItem href={`${basePath}/profile`} label={t('overview')} icon={User} exact onClick={onItemClick} />
      </SidebarSection>

      <SidebarSection title={t('integrations')} icon={<Globe className="h-4 w-4" />} variant="default" defaultExpanded={false}>
        <SidebarNavItem href={`${basePath}/profile?tab=github`} label="GitHub" icon={Github} onClick={onItemClick} />
      </SidebarSection>
    </>
  );
}
