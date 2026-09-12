import {
  buildPublicRouteMetadata,
  MketyPublicRoutePage,
} from '@/features/platform-content/components/public/pages/MketyPublicRoutePage';

export const dynamic = 'force-dynamic';
export const generateMetadata = () => buildPublicRouteMetadata('workspaces');
export default function WorkspacesPage() {
  return <MketyPublicRoutePage slug="workspaces" />;
}
