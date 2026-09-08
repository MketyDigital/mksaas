import { MketyPublicRoutePage, buildPublicRouteMetadata } from '@/features/platform-content/components/public/pages/MketyPublicRoutePage';

export const dynamic = 'force-dynamic';
export const generateMetadata = () => buildPublicRouteMetadata('pricing');
export default function PricingPage() {
  return <MketyPublicRoutePage slug="pricing" />;
}
