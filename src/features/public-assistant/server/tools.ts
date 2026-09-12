import { z } from 'zod';

import { MKETY_PUBLIC_ROUTES } from '@/features/platform-content/public-routes';

import { getPublicPricingKnowledge, getPublicProductKnowledge, searchPublicDocs, searchPublicSite } from './knowledge';

export const PUBLIC_SUPPORT_TOOL_NAMES = [
  'search_public_docs',
  'search_public_site',
  'get_public_pricing',
  'resolve_public_route',
  'get_public_product_summary',
] as const;

export type PublicSupportToolName = (typeof PUBLIC_SUPPORT_TOOL_NAMES)[number];

const searchInputSchema = z.object({ query: z.string().trim().min(2).max(300) });
const routeInputSchema = z.object({ destination: z.string().trim().min(1).max(300) });
const productInputSchema = z.object({ product: z.string().trim().min(1).max(300) });
const emptyInputSchema = z.object({}).strict();

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const EXTERNAL_PRODUCT_ROUTES: Array<{ aliases: string[]; label: string; path: string }> = [
  {
    aliases: ['academy', 'training', 'education', 'mkety academy'],
    label: 'Mkety Academy',
    path: 'https://academy.mkety.com',
  },
];

const ROUTE_ALIASES: Record<string, string> = {
  'agent builder': '/platform',
  documentation: '/docs',
  solutionhub: '/solutions',
  'solution hub': '/solutions',
  automation: '/workspaces',
  deployment: '/workspaces',
  support: '/contact',
  agents: '/platform',
  automate: '/workspaces',
  deploy: '/workspaces',
  docs: '/docs',
  solutions: '/solutions',
  custom: '/enterprise',
  enterprise: '/enterprise',
  trading: '/enterprise',
  'trading workspace': '/enterprise',
  ai: '/platform',
};

export function resolvePublicRoute(destination: string): { label: string; path: string } | null {
  const normalized = normalize(destination);
  const external = EXTERNAL_PRODUCT_ROUTES.find(({ aliases }) =>
    aliases.some((alias) => normalized === alias || normalized.includes(alias)),
  );
  if (external) return { label: external.label, path: external.path };

  const alias = Object.entries(ROUTE_ALIASES)
    .sort(([a], [b]) => b.length - a.length)
    .find(([key]) => normalized === key || normalized.includes(key));
  const aliasPath = alias?.[1];
  const route = aliasPath
    ? MKETY_PUBLIC_ROUTES.find((candidate) => candidate.path === aliasPath)
    : MKETY_PUBLIC_ROUTES.find((candidate) => {
        const key = normalize(candidate.key);
        const label = normalize(candidate.label);
        return normalized === key || normalized === label || normalized.includes(label);
      });

  return route ? { label: route.label, path: route.path } : null;
}

export async function executePublicSupportTool(name: string, input: unknown) {
  if (!PUBLIC_SUPPORT_TOOL_NAMES.includes(name as PublicSupportToolName)) {
    throw new Error(`Public AI tool is not allowed: ${name}`);
  }

  switch (name as PublicSupportToolName) {
    case 'search_public_docs': {
      const { query } = searchInputSchema.parse(input);
      return searchPublicDocs(query);
    }
    case 'search_public_site': {
      const { query } = searchInputSchema.parse(input);
      return searchPublicSite(query);
    }
    case 'get_public_pricing': {
      emptyInputSchema.parse(input);
      return getPublicPricingKnowledge();
    }
    case 'resolve_public_route': {
      const { destination } = routeInputSchema.parse(input);
      return resolvePublicRoute(destination);
    }
    case 'get_public_product_summary': {
      const { product } = productInputSchema.parse(input);
      return getPublicProductKnowledge(product);
    }
  }
}
