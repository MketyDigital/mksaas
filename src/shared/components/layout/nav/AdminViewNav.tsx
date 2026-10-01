'use client';

import {
  BarChart3,
  Brain,
  Building2,
  ClipboardList,
  Command,
  CreditCard,
  Database,
  Globe2,
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  Mail,
  Palette,
  Route,
  Settings,
  Sliders,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { canShowNav, canShowNavAny } from '@/shared/lib/permissions-ui';

import { SidebarNavItem } from '../SidebarNavItem';
import { SidebarSection } from '../SidebarSection';
import { SidebarSeparator } from '../SidebarSeparator';

interface AdminViewNavProps {
  basePath: string;
  permissions?: string[];
  hasPlatformControlAccess?: boolean;
  onItemClick?: () => void;
}

export function AdminViewNav({ basePath, permissions, hasPlatformControlAccess = false, onItemClick }: AdminViewNavProps) {
  const tAdmin = useTranslations('admin');
  const adminBase = `${basePath}/admin`;

  return (
    <>
      {canShowNav(permissions, 'admin:dashboard') && (
        <>
          <SidebarNavItem
            href={adminBase}
            label={tAdmin('dashboard')}
            icon={LayoutDashboard}
            iconTint="primary"
            exact
            onClick={onItemClick}
          />
          {hasPlatformControlAccess ? (
            <SidebarNavItem
              href={`/ops/${basePath.split("/").filter(Boolean).pop()}/platform-control`}
              label="Mkety Control Center"
              icon={Command}
              iconTint="primary"
              onClick={onItemClick}
            />
          ) : null}
          <SidebarNavItem
            href={`${adminBase}/analytics`}
            label={tAdmin('analytics')}
            icon={BarChart3}
            iconTint="performance"
            onClick={onItemClick}
          />
        </>
      )}

      {hasPlatformControlAccess && canShowNavAny(permissions, ['platform:plans', 'platform:billing', 'platform:deployments']) && (
        <>
          <SidebarSeparator />
          <SidebarSection title="Product Operations" icon={<Sparkles className="h-4 w-4" />} variant="admin">
            {canShowNav(permissions, 'platform:plans') && (
              <>
                <SidebarNavItem
                  href={`/ops/${basePath.split("/").filter(Boolean).pop()}/platform-control/ai-operations`}
                  label="Enterprise AI"
                  icon={Sparkles}
                  iconTint="assistant"
                  onClick={onItemClick}
                />
                <SidebarNavItem
                  href={`/ops/${basePath.split("/").filter(Boolean).pop()}/platform-control/mail`}
                  label="Mkety Mail"
                  icon={Mail}
                  iconTint="primary"
                  onClick={onItemClick}
                />
                <SidebarNavItem
                  href={`/ops/${basePath.split("/").filter(Boolean).pop()}/platform-control/media`}
                  label="Mkety Media"
                  icon={ImageIcon}
                  iconTint="primary"
                  onClick={onItemClick}
                />
              </>
            )}
            {canShowNav(permissions, 'platform:billing') && (
              <>
                <SidebarNavItem
                  href={`/ops/${basePath.split("/").filter(Boolean).pop()}/platform-control/billing`}
                  label="Billing & Ledger"
                  icon={WalletCards}
                  iconTint="primary"
                  onClick={onItemClick}
                />
                <SidebarNavItem
                  href={`/ops/${basePath.split("/").filter(Boolean).pop()}/platform-control/payments`}
                  label="Payments"
                  icon={CreditCard}
                  iconTint="primary"
                  onClick={onItemClick}
                />
              </>
            )}
            {canShowNav(permissions, 'platform:deployments') && (
              <SidebarNavItem
                href={`/ops/${basePath.split("/").filter(Boolean).pop()}/platform-control/domains-routing`}
                label="Domains & DNS"
                icon={Route}
                iconTint="primary"
                onClick={onItemClick}
              />
            )}
          </SidebarSection>
        </>
      )}

      <SidebarSeparator />

      {canShowNavAny(permissions, ['admin:members', 'admin:invites', 'admin:settings']) && (
        <SidebarSection title={tAdmin('members')} icon={<Users className="h-4 w-4" />} variant="team">
          {canShowNav(permissions, 'admin:members') && (
            <SidebarNavItem href={`${adminBase}/members`} label={tAdmin('members')} icon={Users} onClick={onItemClick} />
          )}
          {canShowNav(permissions, 'admin:invites') && (
            <SidebarNavItem href={`${adminBase}/invites`} label={tAdmin('invites')} icon={Mail} onClick={onItemClick} />
          )}
          {canShowNav(permissions, 'admin:settings') && (
            <SidebarNavItem href={`${adminBase}/departments`} label={tAdmin('departments')} icon={Building2} onClick={onItemClick} />
          )}
        </SidebarSection>
      )}

      <SidebarSeparator />

      {canShowNavAny(permissions, ['admin:settings', 'admin:roles', 'admin:audit', 'admin:integrations']) && (
        <SidebarSection title="Settings & System" icon={<Settings className="h-4 w-4" />} variant="admin" defaultExpanded={false}>
          {canShowNav(permissions, 'admin:settings') && (
            <>
              <SidebarNavItem href={`${adminBase}/settings`} label={tAdmin('settingsTabs.general')} icon={Settings} exact onClick={onItemClick} />
              <SidebarNavItem href={`${adminBase}/settings/features`} label={tAdmin('settingsTabs.features')} icon={Sliders} onClick={onItemClick} />
              <SidebarNavItem href={`${adminBase}/settings/branding`} label={tAdmin('settingsTabs.branding')} icon={Palette} onClick={onItemClick} />
              <SidebarNavItem href={`${adminBase}/settings/ai-provider`} label={tAdmin('settingsTabs.aiProvider')} icon={Brain} onClick={onItemClick} />
              <SidebarNavItem href={`${adminBase}/settings/storage`} label={tAdmin('settingsTabs.storage')} icon={Database} onClick={onItemClick} />
              <SidebarNavItem href={`${adminBase}/settings/domains`} label="Domains & DNS" icon={Globe2} onClick={onItemClick} />
            </>
          )}
          {canShowNav(permissions, 'admin:roles') && (
            <SidebarNavItem href={`${adminBase}/roles`} label={tAdmin('rolesAndPermissions')} icon={Users} onClick={onItemClick} />
          )}
          {canShowNav(permissions, 'admin:integrations') && (
            <SidebarNavItem href={`${adminBase}/integrations`} label={tAdmin('integrations')} icon={Link2} onClick={onItemClick} />
          )}
          {canShowNav(permissions, 'admin:audit') && (
            <SidebarNavItem href={`${adminBase}/audit-logs`} label={tAdmin('auditLogs')} icon={ClipboardList} onClick={onItemClick} />
          )}
        </SidebarSection>
      )}
    </>
  );
}
