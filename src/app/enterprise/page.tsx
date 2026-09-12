import {
  buildPublicRouteMetadata,
  MketyPublicRoutePage,
} from '@/features/platform-content/components/public/pages/MketyPublicRoutePage';

export const dynamic = 'force-dynamic';
export const generateMetadata = () => buildPublicRouteMetadata('enterprise');
export default function EnterprisePage() {
  return <MketyPublicRoutePage slug="enterprise" />;
}
