import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mkety',
    short_name: 'Mkety',
    description:
      'Build, automate, deploy, integrate, and operate with Mkety.',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#6D5DF6',
    icons: [
      {
        src: '/mkety-logo.png',
        sizes: 'any',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
