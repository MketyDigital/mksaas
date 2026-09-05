import type { AppControlCenterModuleInput } from './schemas';

export type PlatformControlModuleStatus = 'planned' | 'foundation' | 'active' | 'protected';

export type PlatformControlModuleDomain =
  | 'mkety.com'
  | 'app.mkety.com'
  | 'api.mkety.com'
  | 'origin.mkety.com'
  | '*.mkety.app'
  | 'multi-domain'
  | 'internal';

export type PlatformControlModule = AppControlCenterModuleInput & {
  status: PlatformControlModuleStatus;
  domain: PlatformControlModuleDomain;
  editableScope: string[];
  protectedScope: string[];
  implementationNotes: string;
};

export const platformControlModules: PlatformControlModule[] = [
  {
    key: 'public-site-docs',
    label: 'Public Website & Docs',
    description: 'Manage mkety.com pages, docs, navigation, CTAs, FAQs, metadata, and public pricing display.',
    href: '/admin/platform-control/public-site',
    iconKey: 'globe',
    level: 1,
    requiredPermission: 'platform:content',
    sortOrder: 10,
    status: 'foundation',
    domain: 'mkety.com',
    editableScope: ['public pages', 'sections', 'navigation', 'docs', 'public pricing display', 'metadata', 'footer links'],
    protectedScope: ['application source code', 'backend business logic', 'security policy', 'billing ledger behavior'],
    implementationNotes: 'Fallback content and route shell are implemented. Database-backed draft/publish writes come after migration verification.',
  },
  {
    key: 'app-experience',
    label: 'App Experience',
    description: 'Manage dashboard copy, workspace cards, onboarding text, empty states, quick links, and help links.',
    href: '/admin/platform-control/app-experience',
    iconKey: 'layout-dashboard',
    level: 1,
    requiredPermission: 'platform:app-experience',
    sortOrder: 20,
    status: 'foundation',
    domain: 'app.mkety.com',
    editableScope: ['dashboard headline', 'workspace cards', 'empty states', 'onboarding copy', 'support links'],
    protectedScope: ['workspace backend logic', 'tenant isolation', 'entitlement enforcement', 'routing middleware'],
    implementationNotes: 'App experience defaults and admin validation boundary are implemented. Runtime DB reads will replace fallback-only reads after migration verification.',
  },
  {
    key: 'plans-entitlements',
    label: 'Plans & Entitlements',
    description: 'Manage plan presentation, entitlement assignments, feature visibility, usage limits, and upgrade paths.',
    href: '/admin/platform-control/plans',
    iconKey: 'badge-check',
    level: 2,
    requiredPermission: 'platform:plans',
    sortOrder: 30,
    status: 'planned',
    domain: 'app.mkety.com',
    editableScope: ['plan labels', 'public plan display', 'feature visibility', 'upgrade copy', 'entitlement mapping proposals'],
    protectedScope: ['authorization engine', 'billing calculations', 'ledger mutation rules', 'unverified entitlement claims'],
    implementationNotes: 'Must remain aligned with enforceable backend entitlements before public pricing claims are expanded.',
  },
  {
    key: 'billing-ledger',
    label: 'Billing & Ledger',
    description: 'Review ledger entries and create controlled credit, refund, adjustment, and bonus transactions.',
    href: '/admin/platform-control/billing',
    iconKey: 'wallet',
    level: 3,
    requiredPermission: 'platform:billing',
    sortOrder: 40,
    status: 'protected',
    domain: 'app.mkety.com',
    editableScope: ['controlled adjustments', 'refund requests', 'bonus grants', 'ledger review notes'],
    protectedScope: ['direct balance editing', 'destructive ledger mutation', 'frontend invoice calculations', 'payment-provider secrets'],
    implementationNotes: 'Ledger must remain append-oriented and auditable. Admin actions create transactions, never silent balance edits.',
  },
  {
    key: 'deployments-domains',
    label: 'Deployments & Domains',
    description: 'Approve domains, retry jobs, review deployment history, pause deployments, and trigger safe rollbacks.',
    href: '/admin/platform-control/deployments',
    iconKey: 'cloud',
    level: 3,
    requiredPermission: 'platform:deployments',
    sortOrder: 50,
    status: 'planned',
    domain: 'multi-domain',
    editableScope: ['deployment retries', 'domain approvals', 'status visibility', 'rollback requests', 'custom hostname verification'],
    protectedScope: ['deployment engine code', 'Cloudflare secrets', 'OCI secrets', 'origin routing internals'],
    implementationNotes: 'Must preserve the approved domain map and avoid treating origin.mkety.com as a public product surface.',
  },
  {
    key: 'domains-routing',
    label: 'Domains & Routing',
    description: 'Monitor approved Mkety hostnames, routing responsibilities, customer deployment hostnames, and custom-domain flows.',
    href: '/admin/platform-control/domains-routing',
    iconKey: 'route',
    level: 3,
    requiredPermission: 'platform:deployments',
    sortOrder: 60,
    status: 'foundation',
    domain: 'multi-domain',
    editableScope: ['hostname status notes', 'custom-domain review', 'routing visibility', 'domain ownership verification state'],
    protectedScope: ['DNS secret material', 'origin routing changes without review', 'unapproved hostnames', 'customer app isolation'],
    implementationNotes: 'Domain architecture is documented and exposed in control center. Operational integrations should be added behind server actions.',
  },
  {
    key: 'auth-gateway',
    label: 'Auth Gateway',
    description: 'Monitor the central Mkety identity/access gateway, product audiences, JWKS status, key rotation metadata, and access issuance outcomes.',
    href: '/admin/platform-control/auth-gateway',
    iconKey: 'key-round',
    level: 4,
    requiredPermission: 'platform:security',
    sortOrder: 70,
    status: 'planned',
    domain: 'internal',
    editableScope: ['audience registry notes', 'JWKS visibility', 'rotation readiness status', 'issuance monitoring'],
    protectedScope: ['private keys', 'token signing code', 'caller-supplied claims', 'raw ZITADEL coupling'],
    implementationNotes: 'Documented as architecture only in this batch. Real signing/JWKS endpoints require separate security-focused implementation.',
  },
  {
    key: 'security-audit',
    label: 'Security & Audit',
    description: 'View security events, audit logs, role changes, session actions, webhook events, and sensitive operations.',
    href: '/admin/platform-control/security',
    iconKey: 'shield',
    level: 4,
    requiredPermission: 'platform:security',
    sortOrder: 80,
    status: 'protected',
    domain: 'internal',
    editableScope: ['audit review', 'session revocation request flows', 'security event triage notes', 'role-change review'],
    protectedScope: ['tenant isolation rules', 'security bypasses', 'secret exposure', 'destructive audit log edits'],
    implementationNotes: 'Audit visibility may be exposed, but audit history must remain append-oriented and tamper-resistant.',
  },
];
