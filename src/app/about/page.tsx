import { MketyPublicRoutePage, buildPublicRouteMetadata } from '@/features/platform-content/components/public/pages/MketyPublicRoutePage';

export const dynamic = 'force-dynamic';
export const generateMetadata = () => buildPublicRouteMetadata('about');
export default function AboutPage() {
  return <MketyPublicRoutePage slug="about" />;
}
