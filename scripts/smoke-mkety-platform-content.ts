/**
 * Mkety Platform Content Smoke Script
 *
 * Verifies that the CMS migrations, public-assistant migrations, enterprise-checkout migration, seeders, and read loaders work together against a real database.
 */

import { getPublishedAppExperience } from '../src/features/platform-app-experience/server/queries';
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
  if (!condition) {
    throw new Error(`Smoke check failed: ${message}`);
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
  assertSmoke(siteSettings.brandName === 'Mkety', 'site settings should load Mkety brand defaults or published records');

  const navigation = await getPublishedNavigation();
  assertSmoke(navigation.length >= 5, 'navigation should contain Mkety public links');
  assertSmoke(navigation.some((item) => item.label === 'Platform'), 'navigation should include Platform');

  const homepage = await getPublishedHomepageContent();
  assertSmoke(homepage.hero.headline.includes('Build'), 'homepage hero should load Mkety content');
  assertSmoke(homepage.platformOverview.title.length > 0, 'homepage Platform overview should load');
  assertSmoke(homepage.workspaces.items.some((item) => item.key === 'trading'), 'homepage workspaces should keep Trading visible');
  assertSmoke(homepage.solutionHub.title.length > 0, 'homepage SolutionHub section should load');
  assertSmoke(homepage.academy.title.length > 0, 'homepage Academy section should load');
  assertSmoke(homepage.enterprise.title.length > 0, 'homepage Enterprise section should load');
  assertSmoke(homepage.trust.items.length > 0, 'homepage trust/readiness section should load');
  assertSmoke(homepage.faqItems.length > 0, 'homepage FAQ should load');
  assertSmoke(homepage.footerGroups.length > 0, 'homepage footer groups should load');

  for (const slug of ['platform', 'workspaces', 'solutions', 'academy', 'pricing', 'enterprise', 'about', 'contact', 'privacy', 'terms']) {
    const page = await getPublishedPublicPageContent(slug);
    assertSmoke(page?.slug === slug, `public page ${slug} should resolve through CMS or safe default`);
    assertSmoke(page.headline.length > 0, `public page ${slug} should have launch content`);
  }

  const pricing = await getPublishedPricingPlans();
  assertSmoke(pricing.some((plan) => plan.key === 'enterprise'), 'pricing should include Enterprise plan');
  assertSmoke(
    pricing.map((plan) => plan.key).join(',') === 'starter,growth,enterprise',
    'pricing should use deterministic Starter, Growth, Enterprise ordering',
  );

  const docsTree = await getPublishedDocsTree();
  assertSmoke(docsTree.categories.length >= 8, 'docs tree should include the Mkety launch categories');
  for (const slug of ['what-is-mkety', 'projects-and-workspaces', 'ai-workspace', 'automation-workspace', 'deploy-workspace', 'solutionhub', 'academy', 'enterprise-and-trading', 'tenant-isolation']) {
    assertSmoke(docsTree.articles.some((article) => article.slug === slug), `docs launch set should include ${slug}`);
  }

  const firstArticle = docsTree.articles[0];
  assertSmoke(firstArticle, 'docs tree should return at least one article');
  const article = await getPublishedDocsArticle(`${firstArticle.categoryKey}/${firstArticle.slug}`);
  assertSmoke(article?.title, 'docs article should be readable by category/slug');

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