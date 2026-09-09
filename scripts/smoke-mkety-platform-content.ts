/**
 * Mkety Platform Content Smoke Script
 *
 * Verifies that the CMS migrations, public-assistant migrations, enterprise-checkout migration,
 * seeders, and public read loaders work together against a real database.
 */

import { getPublishedAppExperience } from '../src/features/platform-app-experience/server/queries';
import { defaultPricingPlans, defaultWorkspaceSection } from '../src/features/platform-content/defaults';
import { getPublishedPublicPageContent } from '../src/features/platform-content/server/public-page';
import {
  getPublishedDocsArticle,
  getPublishedDocsTree,
  getPublishedHomepageContent,
  getPublishedNavigation,
  getPublishedPlatformSiteSettings,
  getPublishedPricingPlans,
} from '../src/features/platform-content/server/queries';
import { db } from '../src/shared/db';
import {
  platformEnterpriseOrders,
  publicAIConversations,
  publicAIMemoryFacts,
  publicAIMessages,
  publicAIToolRuns,
  publicAIVisitors,
} from '../src/shared/db/schema';

function assertSmoke(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Smoke check failed: ${message}`);
}

function publicPlanContract(plan: (typeof defaultPricingPlans)[number]) {
  return {
    key: plan.key,
    name: plan.name,
    priceLabel: plan.priceLabel,
    billingLabel: plan.billingLabel ?? null,
    description: plan.description,
    highlighted: plan.highlighted,
    ctaLabel: plan.ctaLabel,
    ctaHref: plan.ctaHref,
    features: plan.features,
  };
}

function publicWorkspaceContract(workspace: (typeof defaultWorkspaceSection.items)[number]) {
  return {
    key: workspace.key,
    title: workspace.title,
    description: workspace.description,
    href: workspace.href ?? null,
    badge: workspace.badge ?? null,
  };
}

function assertContractMatch(actual: unknown, expected: unknown, message: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    console.error(`Commercial CMS drift (${message})`);
    console.error(`Actual: ${JSON.stringify(actual, null, 2)}`);
    console.error(`Expected: ${JSON.stringify(expected, null, 2)}`);
    throw new Error(`Smoke check failed: ${message}`);
  }
}

const forbiddenPublicPatterns: Array<[RegExp, string]> = [
  [/\bunder development\b/i, 'under-development language'],
  [/\bWIP\b/i, 'WIP language'],
  [/\bstaging\b/i, 'staging language'],
  [/\bcandidate\b/i, 'candidate language'],
  [/\bdebug(?:ging)?\b/i, 'debug language'],
  [/github/i, 'GitHub references'],
  [/\brepositor(?:y|ies)\b/i, 'repository references'],
  [/MketyDigital/i, 'internal organization references'],
  [/\bmksaas\b/i, 'internal application references'],
  [/\bmklms\b/i, 'internal Academy implementation references'],
  [/\bpull request\b/i, 'pull-request references'],
  [/\borigin\.mkety\.com\b/i, 'internal origin hostname'],
  [/\bcloudflare\b/i, 'hosting-provider implementation details'],
  [/\bvercel\b/i, 'hosting-provider implementation details'],
  [/\bOCI\b/, 'infrastructure-provider implementation details'],
];

function assertPublicCopySafe(value: unknown, label: string) {
  const text = JSON.stringify(value);
  for (const [pattern, description] of forbiddenPublicPatterns) {
    assertSmoke(!pattern.test(text), `${label} must not expose ${description}`);
  }
}

async function assertPublicAIMemoryTables() {
  await Promise.all([
    db.select({ id: publicAIVisitors.id }).from(publicAIVisitors).limit(1),
    db.select({ id: publicAIConversations.id }).from(publicAIConversations).limit(1),
    db.select({ id: publicAIMessages.id }).from(publicAIMessages).limit(1),
    db.select({ id: publicAIMemoryFacts.id }).from(publicAIMemoryFacts).limit(1),
    db.select({ id: publicAIToolRuns.id }).from(publicAIToolRuns).limit(1),
  ]);
}

async function assertEnterpriseCheckoutTables() {
  await db.select({ id: platformEnterpriseOrders.id }).from(platformEnterpriseOrders).limit(1);
}

async function main() {
  console.log('🧪 Running Mkety platform content smoke checks...');

  const siteSettings = await getPublishedPlatformSiteSettings();
  assertSmoke(siteSettings.brandName === 'Mkety', 'site settings should load Mkety brand content');
  assertPublicCopySafe(siteSettings, 'site settings');

  const navigation = await getPublishedNavigation();
  assertSmoke(navigation.length >= 5, 'navigation should contain Mkety public links');
  assertSmoke(navigation.some((item) => item.label === 'Platform'), 'navigation should include Platform');
  assertPublicCopySafe(navigation, 'navigation');

  const homepage = await getPublishedHomepageContent();
  assertSmoke(homepage.hero.headline.includes('Build'), 'homepage hero should load Mkety content');
  assertSmoke(homepage.platformOverview.title.length > 0, 'homepage Platform overview should load');
  assertSmoke(homepage.workspaces.items.some((item) => item.key === 'trading'), 'homepage workspaces should keep Trading visible');
  assertContractMatch(
    homepage.workspaces.items.map(publicWorkspaceContract),
    defaultWorkspaceSection.items.map(publicWorkspaceContract),
    'published workspace names, descriptions, links and Trading boundary should match the documented public contract',
  );
  assertSmoke(homepage.solutionHub.title.length > 0, 'homepage SolutionHub section should load');
  assertSmoke(homepage.academy.items.some((item) => item.title === 'Web & App Engineering'), 'homepage Academy should include the approved learning hubs');
  assertSmoke(homepage.enterprise.title.length > 0, 'homepage Enterprise section should load');
  assertSmoke(homepage.trust.items.length > 0, 'homepage trust section should load');
  assertSmoke(homepage.faqItems.length > 0, 'homepage FAQ should load');
  assertSmoke(homepage.footerGroups.length > 0, 'homepage footer groups should load');
  assertPublicCopySafe(homepage, 'homepage');

  for (const slug of ['platform', 'workspaces', 'solutions', 'academy', 'pricing', 'enterprise', 'about', 'contact', 'privacy', 'terms']) {
    const page = await getPublishedPublicPageContent(slug);
    assertSmoke(page?.slug === slug, `public page ${slug} should resolve through CMS or safe default`);
    assertSmoke(page.headline.length > 0, `public page ${slug} should have launch content`);
    assertPublicCopySafe(page, `public page ${slug}`);
  }

  const pricing = await getPublishedPricingPlans();
  assertSmoke(
    pricing.map((plan) => plan.key).join(',') === 'starter,ai-workspace,automation-workspace,deploy-workspace,mkety-one,enterprise',
    'pricing should use canonical Starter, Workspaces, Mkety One, Enterprise ordering',
  );
  assertSmoke(!pricing.some((plan) => /^(growth|pro|business)$/i.test(plan.key)), 'pricing must not expose removed Growth, Pro or Business plans');
  assertContractMatch(
    pricing.map(publicPlanContract),
    defaultPricingPlans.map(publicPlanContract),
    'published plan names, pricing labels, descriptions, features and CTAs should match the documented public contract',
  );
  assertPublicCopySafe(pricing, 'pricing');

  const docsTree = await getPublishedDocsTree();
  assertSmoke(docsTree.categories.length >= 8, 'docs tree should include the Mkety production categories');
  for (const slug of ['what-is-mkety', 'projects-and-workspaces', 'plans-usage-credits', 'ai-workspace', 'automation-workspace', 'deploy-workspace', 'solutionhub', 'academy', 'enterprise-and-trading', 'domain-map', 'account-security', 'privacy-and-access']) {
    assertSmoke(docsTree.articles.some((article) => article.slug === slug), `docs production set should include ${slug}`);
  }
  assertPublicCopySafe(docsTree, 'docs navigation');

  for (const doc of docsTree.articles) {
    const article = await getPublishedDocsArticle(`${doc.categoryKey}/${doc.slug}`);
    assertSmoke(article?.title, `docs article ${doc.slug} should be readable`);
    assertPublicCopySafe(article, `docs article ${doc.slug}`);
  }

  await assertPublicAIMemoryTables();
  await assertEnterpriseCheckoutTables();

  const appExperience = await getPublishedAppExperience();
  assertSmoke(appExperience.dashboard.headline.includes('Mkety'), 'app experience dashboard should load Mkety headline');
  assertSmoke(appExperience.workspaces.some((workspace) => workspace.key === 'trading'), 'app experience should keep Trading visible');
  assertSmoke(
    appExperience.controlCenterModules.some((controlModule) => controlModule.key === 'public-site-docs'),
    'control center should include Public Website & Docs module',
  );

  console.log('✅ Mkety platform content smoke checks passed.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Mkety content smoke failed');
    process.exit(1);
  });
