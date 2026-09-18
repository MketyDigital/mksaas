import type { Metadata } from 'next';

import { MketyHomePage } from '@/features/platform-content/components/public/MketyHomePage';
import { buildMketyMetadata } from '@/features/platform-content/metadata';
import { getPublishedPublicHomepageContent } from '@/features/platform-content/server/public-homepage';
import { getPublishedPublicPageSeo } from '@/features/platform-content/server/public-page-query';
import { getPublishedPlatformSiteSettings } from '@/features/platform-content/server/queries';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const [settings, page] = await Promise.all([getPublishedPlatformSiteSettings(), getPublishedPublicPageSeo('home')]);

  return buildMketyMetadata({
    settings,
    path: '/',
    title: page?.seoTitle ?? page?.title,
    description: page?.seoDescription,
  });
}

export default async function Home() {
  const content = await getPublishedPublicHomepageContent();
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://mkety.com/#organization',
        name: 'Mkety',
        url: 'https://mkety.com/',
        logo: 'https://mkety.com/mkety-logo.png',
        description:
          'Mkety is a technology platform for AI, automation, deployment management, business solutions, practical learning, and Enterprise delivery.',
      },
      {
        '@type': 'WebSite',
        '@id': 'https://mkety.com/#website',
        url: 'https://mkety.com/',
        name: 'Mkety',
        publisher: { '@id': 'https://mkety.com/#organization' },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <MketyHomePage content={content} />
    </>
  );
}
