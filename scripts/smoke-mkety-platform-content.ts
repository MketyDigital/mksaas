/**
 * Mkety Platform Content Smoke Script
 *
 * Verifies the seeded production content contract against a real PostgreSQL
 * database without importing Cloudflare-only runtime modules.
 */

import { and, asc, eq, isNull } from 'drizzle-orm';

import { defaultAppExperience } from '../src/features/platform-app-experience/defaults';
import { defaultPricingPlans } from '../src/features/platform-content/defaults';
import { db } from '../src/shared/db/node';
import {
  platformAppControlCenterModules,
  platformAppDashboardSettings,
  platformWorkspaceCards,
} from '../src/shared/db/schema/platform-app-experience';
import {
  platformDocsArticles,
  platformDocsCategories,
  platformNavigationItems,
  platformPages,
  platformPageSections,
  platformPricingFeatures,
  platformPricingPlans,
  platformSiteSettings,
} from '../src/shared/db/schema/platform-content';
import {
  platformEnterpriseOrders,
  publicAIConversations,
  publicAIMemoryFacts,
  publicAIMessages,
  publicAIToolRuns,
  publicAIVisitors,
} from '../src/shared/db/schema';

const PUBLISHED = 'published' as const;

function assertSmoke(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Smoke check failed: ${message}`);
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

  const siteSettings = await db.query.platformSiteSettings.findFirst({
    where: and(
      eq(platformSiteSettings.environment, 'production'),
      eq(platformSiteSettings.status, PUBLISHED),
    ),
  });
  assertSmoke(siteSettings?.brandName === 'Mkety', 'site settings should contain published Mkety brand content');
  assertPublicCopySafe(siteSettings, 'site settings');

  const navigation = await db.query.platformNavigationItems.findMany({
    where: and(
      eq(platformNavigationItems.status, PUBLISHED),
      eq(platformNavigationItems.enabled, true),
    ),
    orderBy: [asc(platformNavigationItems.area), asc(platformNavigationItems.sortOrder)],
  });
  assertSmoke(navigation.length >= 5, 'navigation should contain Mkety public links');
  assertSmoke(navigation.some((item) => item.label === 'Platform'), 'navigation should include Platform');
  assertPublicCopySafe(navigation, 'navigation');

  const home = await db.query.platformPages.findFirst({
    where: and(
      eq(platformPages.slug, 'home'),
      eq(platformPages.status, PUBLISHED),
      eq(platformPages.enabled, true),
    ),
  });
  assertSmoke(home, 'published home page should exist');

  const homeSections = await db.query.platformPageSections.findMany({
    where: and(
      eq(platformPageSections.pageId, home.id),
      eq(platformPageSections.status, PUBLISHED),
      eq(platformPageSections.enabled, true),
    ),
    orderBy: [asc(platformPageSections.sortOrder)],
  });
  const homeSectionKeys = new Set(homeSections.map((section) => section.sectionKey));
  for (const key of ['hero', 'platform', 'workspaces', 'solutions', 'academy', 'enterprise', 'trust', 'faq', 'footer']) {
    assertSmoke(homeSectionKeys.has(key), `homepage should contain ${key} section`);
  }
  const workspacePayload = homeSections.find((section) => section.sectionKey === 'workspaces')?.contentJson;
  assertSmoke(
    JSON.stringify(workspacePayload).includes('"key":"trading"'),
    'homepage workspaces should keep Trading visible',
  );
  assertSmoke(
    JSON.stringify(workspacePayload).includes('/?mketyAI=enterprise-sales'),
    'public Trading sales should begin through Mkety AI Enterprise intake',
  );
  assertPublicCopySafe(homeSections, 'homepage sections');

  for (const slug of [
    'platform',
    'workspaces',
    'solutions',
    'academy',
    'pricing',
    'enterprise',
    'about',
    'contact',
    'privacy',
    'terms',
  ]) {
    const page = await db.query.platformPages.findFirst({
      where: and(
        eq(platformPages.slug, slug),
        eq(platformPages.status, PUBLISHED),
        eq(platformPages.enabled, true),
      ),
    });
    assertSmoke(page, `public page ${slug} should be published`);
    assertSmoke(page.title.length > 0, `public page ${slug} should have a title`);
    const sections = await db.query.platformPageSections.findMany({
      where: and(
        eq(platformPageSections.pageId, page.id),
        eq(platformPageSections.status, PUBLISHED),
        eq(platformPageSections.enabled, true),
      ),
      orderBy: [asc(platformPageSections.sortOrder)],
    });
    assertSmoke(sections.length > 0, `public page ${slug} should have published content`);
    assertPublicCopySafe({ page, sections }, `public page ${slug}`);
  }

  const pricing = await db.query.platformPricingPlans.findMany({
    where: eq(platformPricingPlans.status, PUBLISHED),
    orderBy: [asc(platformPricingPlans.sortOrder)],
  });
  assertSmoke(
    pricing.map((plan) => plan.key).join(',') ===
      'starter,ai-workspace,automation-workspace,deploy-workspace,mkety-one,enterprise',
    'pricing should use canonical Starter, Workspaces, Mkety One, Enterprise ordering',
  );
  assertSmoke(
    !pricing.some((plan) => /^(growth|pro|business)$/i.test(plan.key)),
    'pricing must not expose removed Growth, Pro or Business plans',
  );

  const pricingFeatures = await db.query.platformPricingFeatures.findMany({
    where: eq(platformPricingFeatures.enabled, true),
    orderBy: [asc(platformPricingFeatures.sortOrder)],
  });
  const pricingContract = pricing.map((plan) => ({
    key: plan.key,
    name: plan.name,
    priceLabel: plan.priceLabel,
    billingLabel: plan.billingLabel ?? null,
    description: plan.description,
    highlighted: plan.highlighted,
    ctaLabel: plan.ctaLabel,
    ctaHref: plan.ctaHref,
    features: pricingFeatures.filter((feature) => feature.planId === plan.id).map((feature) => feature.label),
  }));

  for (const expected of defaultPricingPlans) {
    const actual = pricingContract.find((plan) => plan.key === expected.key);
    assertSmoke(actual, `published pricing should include ${expected.key}`);
    assertSmoke(actual.name === expected.name, `${expected.key} should keep its canonical plan name`);
    assertSmoke(actual.priceLabel === expected.priceLabel, `${expected.key} should keep its canonical price label`);
    assertSmoke(
      actual.billingLabel === (expected.billingLabel ?? null),
      `${expected.key} should keep its canonical billing label`,
    );
    assertSmoke(actual.ctaLabel === expected.ctaLabel, `${expected.key} should keep its canonical CTA label`);
    assertSmoke(actual.ctaHref === expected.ctaHref, `${expected.key} should keep its canonical CTA route`);
    assertSmoke(actual.features.length > 0, `${expected.key} should expose at least one published feature`);
  }
  assertPublicCopySafe(pricingContract, 'pricing');

  const docsCategories = await db.query.platformDocsCategories.findMany({
    where: eq(platformDocsCategories.status, PUBLISHED),
    orderBy: [asc(platformDocsCategories.sortOrder)],
  });
  assertSmoke(docsCategories.length >= 8, 'docs should include the production categories');

  const docsArticles = await db
    .select({
      categoryKey: platformDocsCategories.key,
      slug: platformDocsArticles.slug,
      title: platformDocsArticles.title,
      bodyMarkdown: platformDocsArticles.bodyMarkdown,
    })
    .from(platformDocsArticles)
    .innerJoin(platformDocsCategories, eq(platformDocsArticles.categoryId, platformDocsCategories.id))
    .where(
      and(
        eq(platformDocsArticles.status, PUBLISHED),
        eq(platformDocsCategories.status, PUBLISHED),
      ),
    )
    .orderBy(asc(platformDocsCategories.sortOrder), asc(platformDocsArticles.sortOrder));

  for (const slug of [
    'what-is-mkety',
    'projects-and-workspaces',
    'plans-usage-credits',
    'ai-workspace',
    'automation-workspace',
    'deploy-workspace',
    'solutionhub',
    'academy',
    'enterprise-and-trading',
    'domain-map',
    'account-security',
    'privacy-and-access',
  ]) {
    assertSmoke(docsArticles.some((article) => article.slug === slug), `docs should include ${slug}`);
  }
  assertPublicCopySafe({ docsCategories, docsArticles }, 'docs content');

  await assertPublicAIMemoryTables();
  await assertEnterpriseCheckoutTables();

  const dashboard = await db.query.platformAppDashboardSettings.findFirst({
    where: and(
      eq(platformAppDashboardSettings.status, PUBLISHED),
      eq(platformAppDashboardSettings.environment, 'production'),
      isNull(platformAppDashboardSettings.tenantId),
    ),
  });
  assertSmoke(dashboard?.headline.includes('Mkety'), 'app dashboard should contain the Mkety headline');

  const workspaces = await db.query.platformWorkspaceCards.findMany({
    where: and(eq(platformWorkspaceCards.status, PUBLISHED), isNull(platformWorkspaceCards.tenantId)),
    orderBy: [asc(platformWorkspaceCards.sortOrder)],
  });
  assertSmoke(workspaces.some((workspace) => workspace.workspaceKey === 'trading'), 'app experience should keep Trading visible');
  assertSmoke(
    workspaces.map((workspace) => workspace.workspaceKey).join(',') ===
      defaultAppExperience.workspaces.map((workspace) => workspace.key).join(','),
    'published workspace ordering should match the app workspace contract',
  );

  const controlCenterModules = await db.query.platformAppControlCenterModules.findMany({
    where: eq(platformAppControlCenterModules.status, PUBLISHED),
    orderBy: [asc(platformAppControlCenterModules.sortOrder)],
  });
  assertSmoke(
    controlCenterModules.some((module) => module.moduleKey === 'public-site-docs'),
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
