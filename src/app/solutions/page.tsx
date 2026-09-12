import {
  buildPublicRouteMetadata,
  MketyPublicRoutePage,
} from '@/features/platform-content/components/public/pages/MketyPublicRoutePage';

export const dynamic = 'force-dynamic';
export const generateMetadata = () => buildPublicRouteMetadata('solutions');
export default function SolutionsPage() {
  return <MketyPublicRoutePage slug="solutions" />;
}
