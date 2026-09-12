import {
  buildPublicRouteMetadata,
  MketyPublicRoutePage,
} from '@/features/platform-content/components/public/pages/MketyPublicRoutePage';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return buildPublicRouteMetadata('privacy');
}

export default function PrivacyPage() {
  return <MketyPublicRoutePage slug="privacy" />;
}
