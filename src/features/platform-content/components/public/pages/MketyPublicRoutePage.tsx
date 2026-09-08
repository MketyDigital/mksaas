import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { buildMketyMetadata } from '../../../metadata';
import { getPublishedPublicChrome } from '../../../server/public-chrome';
import { getPublishedPublicPageContent } from '../../../server/public-page';
import { MketyPublicPage } from './MketyPublicPage';

export async function buildPublicRouteMetadata(slug: string): Promise<Metadata> {
  const [page, chrome] = await Promise.all([
    getPublishedPublicPageContent(slug),
    getPublishedPublicChrome(),
  ]);

  if (!page) {
    return buildMketyMetadata({ settings: chrome.settings, path: '/', title: 'Mkety' });
  }

  return buildMketyMetadata({
    settings: chrome.settings,
    path: `/${page.slug}`,
    title: page.seoTitle,
    description: page.seoDescription,
  });
}

export async function MketyPublicRoutePage({ slug }: { slug: string }) {
  const [page, chrome] = await Promise.all([
    getPublishedPublicPageContent(slug),
    getPublishedPublicChrome(),
  ]);

  if (!page) notFound();

  return (
    <MketyPublicPage
      page={page}
      settings={chrome.settings}
      navigation={chrome.navigation}
      footerGroups={chrome.footerGroups}
    />
  );
}
