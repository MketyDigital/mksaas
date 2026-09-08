import { getPublishedPublicPageContent } from '@/features/platform-content/server/public-page';
import {
  getPublishedDocsTree,
  getPublishedHomepageContent,
  getPublishedPricingPlans,
} from '@/features/platform-content/server/queries';

const MAX_RESULT_TEXT = 1800;
const MAX_RESULTS = 5;

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function terms(query: string) {
  return normalize(query)
    .split(' ')
    .filter((term) => term.length > 1)
    .slice(0, 12);
}

function scoreText(query: string, ...values: Array<string | undefined>) {
  const queryTerms = terms(query);
  if (queryTerms.length === 0) return 0;
  const haystack = normalize(values.filter(Boolean).join(' '));
  return queryTerms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function bounded(value: string) {
  return value.length > MAX_RESULT_TEXT ? `${value.slice(0, MAX_RESULT_TEXT)}…` : value;
}

export interface PublicKnowledgeResult {
  type: 'doc' | 'page';
  title: string;
  path: string;
  excerpt: string;
  score: number;
}

export async function searchPublicDocs(query: string): Promise<PublicKnowledgeResult[]> {
  const tree = await getPublishedDocsTree();

  return tree.articles
    .map((article) => ({
      type: 'doc' as const,
      title: article.title,
      path: `/docs/${article.categoryKey}/${article.slug}`,
      excerpt: bounded(article.excerpt ?? article.bodyMarkdown),
      score: scoreText(query, article.title, article.excerpt, article.bodyMarkdown, article.categoryKey),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, MAX_RESULTS);
}

const SEARCHABLE_PUBLIC_PAGE_SLUGS = [
  'platform',
  'workspaces',
  'solutions',
  'academy',
  'pricing',
  'enterprise',
  'about',
  'contact',
] as const;

export async function searchPublicSite(query: string): Promise<PublicKnowledgeResult[]> {
  const pages = await Promise.all(
    SEARCHABLE_PUBLIC_PAGE_SLUGS.map((slug) => getPublishedPublicPageContent(slug)),
  );

  return pages
    .filter((page): page is NonNullable<typeof page> => Boolean(page))
    .map((page) => {
      const sectionText = page.sections
        .map((section) => `${section.title} ${section.description} ${section.items.map((item) => `${item.title} ${item.description}`).join(' ')}`)
        .join(' ');
      return {
        type: 'page' as const,
        title: page.title,
        path: `/${page.slug}`,
        excerpt: bounded(`${page.headline}. ${page.intro}`),
        score: scoreText(query, page.title, page.headline, page.intro, sectionText),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, MAX_RESULTS);
}

export async function getPublicPricingKnowledge() {
  const plans = await getPublishedPricingPlans();
  return plans.map((plan) => ({
    key: plan.key,
    name: plan.name,
    priceLabel: plan.priceLabel,
    billingLabel: plan.billingLabel,
    description: plan.description,
    features: plan.features.slice(0, 12),
    ctaLabel: plan.ctaLabel,
    ctaHref: plan.ctaHref,
  }));
}

export async function getPublicProductKnowledge(product: string) {
  const normalized = normalize(product);
  const aliases: Array<[string[], string]> = [
    [['platform', 'mkety platform', 'ai', 'agent builder'], 'platform'],
    [['workspace', 'workspaces', 'automation', 'automate', 'deploy'], 'workspaces'],
    [['solutionhub', 'solution hub', 'solutions', 'templates'], 'solutions'],
    [['academy', 'training', 'education'], 'academy'],
    [['enterprise', 'custom', 'trading'], 'enterprise'],
  ];
  const slug = aliases.find(([names]) => names.some((name) => normalized.includes(name)))?.[1];
  if (!slug) return null;

  const page = await getPublishedPublicPageContent(slug);
  if (!page) return null;

  if (normalized.includes('trading')) {
    const homepage = await getPublishedHomepageContent();
    const trading = homepage.workspaces.items.find((item) => item.key === 'trading');
    return {
      key: 'trading',
      title: trading?.title ?? 'Trading',
      summary:
        trading?.description ??
        'Trading is a specialized Mkety business solution available through Custom or Enterprise engagement.',
      path: '/enterprise',
      commercialModel: 'Custom / Enterprise',
    };
  }

  return {
    key: slug,
    title: page.title,
    summary: bounded(`${page.headline}. ${page.intro}`),
    path: `/${slug}`,
  };
}
