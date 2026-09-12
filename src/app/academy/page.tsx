import {
  buildPublicRouteMetadata,
  MketyPublicRoutePage,
} from '@/features/platform-content/components/public/pages/MketyPublicRoutePage';

export const dynamic = 'force-dynamic';
export const generateMetadata = () => buildPublicRouteMetadata('academy');
export default function AcademyPage() {
  return <MketyPublicRoutePage slug="academy" />;
}
