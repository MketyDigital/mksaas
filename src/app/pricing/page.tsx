import { notFound } from 'next/navigation';

import { MketyPricingPlans } from '@/features/platform-content/components/public/pages/MketyPricingPlans';
import { MketyPublicPage } from '@/features/platform-content/components/public/pages/MketyPublicPage';
import { buildPublicRouteMetadata } from '@/features/platform-content/components/public/pages/MketyPublicRoutePage';
import { getPublishedPublicChrome } from '@/features/platform-content/server/public-chrome';
import { getPublishedPublicPageContent } from '@/features/platform-content/server/public-page';
import { getPublishedPricingPlans } from '@/features/platform-content/server/queries';

export const dynamic = 'force-dynamic';
export const generateMetadata = () => buildPublicRouteMetadata('pricing');

export default async function PricingPage() {
  const [page, chrome, plans] = await Promise.all([
    getPublishedPublicPageContent('pricing'),
    getPublishedPublicChrome(),
    getPublishedPricingPlans(),
  ]);

  if (!page) notFound();

  return (
    <MketyPublicPage
      page={page}
      settings={chrome.settings}
      navigation={chrome.navigation}
      footerGroups={chrome.footerGroups}
      featuredContent={<MketyPricingPlans plans={plans} />}
    />
  );
}
