import {
  buildPublicRouteMetadata,
  MketyPublicRoutePage,
} from '@/features/platform-content/components/public/pages/MketyPublicRoutePage';

export const dynamic = 'force-dynamic';
export const generateMetadata = () => buildPublicRouteMetadata('infrastructure');
export default function InfrastructurePage() {
  return <MketyPublicRoutePage slug="infrastructure" />;
}
