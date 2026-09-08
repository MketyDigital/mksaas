import type { Metadata } from 'next';

import { MketyHomePage } from '@/features/platform-content/components/public/MketyHomePage';
import { buildMketyMetadata } from '@/features/platform-content/metadata';
import { getPublishedPublicPageSeo } from '@/features/platform-content/server/public-page-query';
import { getPublishedHomepageContent, getPublishedPlatformSiteSettings } from '@/features/platform-content/server/queries';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [settings, page] = await Promise.all([
    getPublishedPlatformSiteSettings(),
    getPublishedPublicPageSeo('home'),
  ]);

  return buildMketyMetadata({
    settings,
    path: '/',
    title: page?.seoTitle ?? page?.title,
    description: page?.seoDescription,
  });
}

export default async function Home() {
  const content = await getPublishedHomepageContent();

  return <MketyHomePage content={content} />;
}
