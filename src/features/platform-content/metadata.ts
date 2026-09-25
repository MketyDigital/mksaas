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
    const parsed =
      input.startsWith('http://') || input.startsWith('https://')
        ? new URL(input)
        : new URL(input.startsWith('/') ? input : `/${input}`, MKETY_PUBLIC_ORIGIN);

    const pathname = parsed.pathname || fallback;
    return pathname.startsWith('/') ? pathname : `/${pathname}`;
  } catch {
    return fallback;
  }
}

function getSocialImage(settings: PlatformSiteSettingsInput) {
  return settings.socialImageUrl?.startsWith('https://')
    ? settings.socialImageUrl
    : `${MKETY_PUBLIC_ORIGIN}/mkety-social-card.png`;
}

export function buildMketyMetadata({ settings, path, title, description }: BuildMketyMetadataInput): Metadata {
  const resolvedTitle = title?.trim() || settings.defaultSeoTitle;
  const resolvedDescription = description?.trim() || settings.defaultSeoDescription;
  const publicPath = normalizePublicPath(path);
  const canonical = new URL(publicPath, MKETY_PUBLIC_ORIGIN).toString();
  const socialImage = getSocialImage(settings);
  const configuredIcon = settings.faviconUrl?.startsWith('https://') ? settings.faviconUrl : undefined;
  const appleIcon = `${MKETY_PUBLIC_ORIGIN}/apple-icon.png`;

  return {
    metadataBase: new URL(MKETY_PUBLIC_ORIGIN),
    applicationName: 'Mkety',
    title: resolvedTitle,
    description: resolvedDescription,
    creator: 'Mkety',
    publisher: 'Mkety',
    category: 'technology',
    keywords: [
      'Mkety',
      'AI agents',
      'workflow automation',
      'serverless deployment',
      'business software',
      'media storage and delivery',
    ],
    referrer: 'origin-when-cross-origin',
    formatDetection: {
      telephone: false,
      email: false,
      address: false,
    },
    manifest: '/manifest.webmanifest',
    icons: {
      icon: configuredIcon
        ? [{ url: configuredIcon }, { url: '/favicon.ico', type: 'image/x-icon' }]
        : [{ url: '/favicon.ico', type: 'image/x-icon' }, { url: '/icon.png', type: 'image/png' }],
      shortcut: configuredIcon ?? '/favicon.ico',
      apple: appleIcon,
    },
    alternates: {
      canonical,
    },
    openGraph: {
      type: 'website',
      siteName: 'Mkety',
      locale: 'en_US',
      title: resolvedTitle,
      description: resolvedDescription,
      url: canonical,
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 630,
          alt: 'Mkety — build, automate, deploy, and operate',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: resolvedTitle,
      description: resolvedDescription,
      images: [socialImage],
    },
  };
}
