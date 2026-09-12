import {
  buildPublicRouteMetadata,
  MketyPublicRoutePage,
} from '@/features/platform-content/components/public/pages/MketyPublicRoutePage';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return buildPublicRouteMetadata('terms');
}

export default function TermsPage() {
  return <MketyPublicRoutePage slug="terms" />;
}
