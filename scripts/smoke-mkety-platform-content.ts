/**
 * Mkety Platform Content Smoke Script
 *
 * Verifies that the CMS migrations, seeders, and read loaders work together against a real database.
 * Run after migrations and seeds:
 *
 *   pnpm db:migrate
 *   pnpm db:seed:mkety-content
 *   pnpm db:smoke:mkety-content
 */

import { getPublishedAppExperience } from '../src/features/platform-app-experience/server/queries';
import {
  getPublishedDocsArticle,
  getPublishedDocsTree,
  getPublishedHomepageContent,
  getPublishedNavigation,
  getPublishedPlatformSiteSettings,
  getPublishedPricingPlans,
} from '../src/features/platform-content/server/queries';

function assertSmoke(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Smoke check failed: ${message}`);
  }
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
  assertSmoke(homepage.workspaces.items.some((item) => item.title === 'Trading'), 'homepage workspaces should keep Trading visible');

  const pricing = await getPublishedPricingPlans();
  assertSmoke(pricing.some((plan) => plan.key === 'enterprise'), 'pricing should include Enterprise plan');

  const docsTree = await getPublishedDocsTree();
  assertSmoke(docsTree.categories.length > 0, 'docs tree should include categories');
  assertSmoke(docsTree.articles.length > 0, 'docs tree should include articles');

  const firstArticle = docsTree.articles[0];
  assertSmoke(firstArticle, 'docs tree should return at least one article');

  const article = await getPublishedDocsArticle(`${firstArticle.categoryKey}/${firstArticle.slug}`);
  assertSmoke(article?.title, 'docs article should be readable by category/slug');

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
    console.error(error);
    process.exit(1);
  });
