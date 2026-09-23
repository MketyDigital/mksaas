export type SolutionHubDeliveryClass = 'shared-platform' | 'enterprise-custom';

export type SolutionHubCategory =
  | 'ai'
  | 'automation'
  | 'web-apps'
  | 'business-systems'
  | 'trading';

export type SolutionHubWorkspaceTarget = 'ai' | 'automation' | 'deploy';

export type SolutionHubCatalogEntry = {
  key:
    | 'customer-support-ai'
    | 'ai-knowledge-assistant'
    | 'lead-capture-automation'
    | 'telegram-workflow'
    | 'marketing-automation'
    | 'business-website'
    | 'complex-erp'
    | 'regulated-data-system'
    | 'private-dedicated-runtime'
    | 'trading-automation';
  title: string;
  description: string;
  category: SolutionHubCategory;
  deliveryClass: SolutionHubDeliveryClass;
  workspaceTarget?: SolutionHubWorkspaceTarget;
  enterpriseReason?: string;
};

export const solutionHubCatalog: SolutionHubCatalogEntry[] = [
  {
    key: 'customer-support-ai',
    title: 'Customer Support AI',
    description: 'Build a support assistant with approved knowledge, tools, testing, publishing, and conversation history.',
    category: 'ai',
    deliveryClass: 'shared-platform',
    workspaceTarget: 'ai',
  },
  {
    key: 'ai-knowledge-assistant',
    title: 'AI Knowledge Assistant',
    description: 'Create a document and knowledge assistant for internal or customer-facing questions using the AI Workspace.',
    category: 'ai',
    deliveryClass: 'shared-platform',
    workspaceTarget: 'ai',
  },
  {
    key: 'lead-capture-automation',
    title: 'Lead Capture Automation',
    description: 'Design webhook and API-driven lead flows with conditions, notifications, execution history, and protected integration configuration.',
    category: 'automation',
    deliveryClass: 'shared-platform',
    workspaceTarget: 'automation',
  },
  {
    key: 'telegram-workflow',
    title: 'Telegram Workflow',
    description: 'Combine supported messaging integrations with Mkety workflow actions and auditable automation runs.',
    category: 'automation',
    deliveryClass: 'shared-platform',
    workspaceTarget: 'automation',
  },
  {
    key: 'marketing-automation',
    title: 'Marketing Automation',
    description: 'Build bounded campaign, notification, approval, API, and schedule-ready workflow foundations without browser automation.',
    category: 'automation',
    deliveryClass: 'shared-platform',
    workspaceTarget: 'automation',
  },
  {
    key: 'business-website',
    title: 'Business Website',
    description: 'Start a lightweight website or portal path and continue into Mkety managed application delivery where supported.',
    category: 'web-apps',
    deliveryClass: 'shared-platform',
    workspaceTarget: 'deploy',
  },
  {
    key: 'complex-erp',
    title: 'Complex ERP',
    description: 'Large multi-module business systems require reviewed architecture, delivery scope, infrastructure, and commercial terms.',
    category: 'business-systems',
    deliveryClass: 'enterprise-custom',
    enterpriseReason: 'Complex ERP belongs to Enterprise/Custom delivery rather than shared self-service provisioning.',
  },
  {
    key: 'regulated-data-system',
    title: 'Regulated Data System',
    description: 'Substantial health, financial, education, or other regulated-data systems require a reviewed security and infrastructure boundary.',
    category: 'business-systems',
    deliveryClass: 'enterprise-custom',
    enterpriseReason: 'Regulated or substantial sensitive-data systems require Enterprise review and delivery controls.',
  },
  {
    key: 'private-dedicated-runtime',
    title: 'Private / Dedicated Runtime',
    description: 'Private databases, networking, models, persistent services, containers, or dedicated environments are scoped as Enterprise infrastructure.',
    category: 'business-systems',
    deliveryClass: 'enterprise-custom',
    enterpriseReason: 'Dedicated and private runtime requirements are outside the standard shared-platform envelope.',
  },
  {
    key: 'trading-automation',
    title: 'Trading Automation',
    description: 'Specialized trading automation, signal workflows, execution infrastructure, monitoring, and integrations remain Custom / Enterprise.',
    category: 'trading',
    deliveryClass: 'enterprise-custom',
    enterpriseReason: 'Trading remains a standalone specialized Enterprise solution and is never a normal self-service install.',
  },
];

export function getSolutionHubEntriesByClass(deliveryClass: SolutionHubDeliveryClass) {
  return solutionHubCatalog.filter((entry) => entry.deliveryClass === deliveryClass);
}

export function getSolutionHubEntryDestination(
  entry: SolutionHubCatalogEntry,
  context: { tenantSlug: string; projectSlug: string },
) {
  if (entry.deliveryClass === 'enterprise-custom') {
    return '/enterprise';
  }

  if (!entry.workspaceTarget) {
    throw new Error(`Shared-platform SolutionHub entry has no workspace target: ${entry.key}`);
  }

  return `/t/${context.tenantSlug}/projects/${context.projectSlug}/${entry.workspaceTarget}`;
}

export function getSolutionHubEntryCtaLabel(entry: SolutionHubCatalogEntry) {
  if (entry.deliveryClass === 'enterprise-custom') {
    return 'Request Enterprise';
  }

  switch (entry.workspaceTarget) {
    case 'ai':
      return 'Open AI Workspace';
    case 'automation':
      return 'Open Automation';
    case 'deploy':
      return 'Open Deploy';
    default:
      return 'Open Workspace';
  }
}
