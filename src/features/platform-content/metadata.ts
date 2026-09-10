import type { Metadata } from 'next';

import type { PlatformSiteSettingsInput } from './schemas';

export const MKETY_PUBLIC_ORIGIN = 'https://mkety.com' as const;

interface BuildMketyMetadataInput {
  settings: PlatformSiteSettingsInput;
  path: string;
  title?: string | null;
  description?: string | null;
}

function normalizePublicPath(input: string) {
  const fallback = '/';

  try {
    const parsed = input.startsWith('http://') || input.startsWith('https://')
      ? new URL(input)
      : new URL(input.startsWith('/') ? input : `/${input}`, MKETY_PUBLIC_ORIGIN);

    const pathname = parsed.pathname || fallback;
    return pathname.startsWith('/') ? pathname : `/${pathname}`;
  } catch {
    return fallback;
  }
}

function getSocialImage(settings: PlatformSiteSettingsInput) {
  return settings.socialImageUrl?.startsWith('https://') ? settings.socialImageUrl : undefined;
}

export function buildMketyMetadata({ settings, path, title, description }: BuildMketyMetadataInput): Metadata {
  const resolvedTitle = title?.trim() || settings.defaultSeoTitle;
  const resolvedDescription = description?.trim() || settings.defaultSeoDescription;
  const publicPath = normalizePublicPath(path);
  const canonical = new URL(publicPath, MKETY_PUBLIC_ORIGIN).toString();
  const socialImage = getSocialImage(settings);

  return {
    metadataBase: new URL(MKETY_PUBLIC_ORIGIN),
    applicationName: 'Mkety',
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: {
      canonical,
    },
    openGraph: {
      type: 'website',
      siteName: 'Mkety',
      title: resolvedTitle,
      description: resolvedDescription,
      url: canonical,
      ...(socialImage ? { images: [socialImage] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: resolvedTitle,
      description: resolvedDescription,
      ...(socialImage ? { images: [socialImage] } : {}),
    },
  };
}
