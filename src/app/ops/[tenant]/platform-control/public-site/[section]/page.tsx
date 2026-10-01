import PublicSiteSectionPage from '@/app/(tenant)/t/[tenant]/admin/platform-control/public-site/[section]/page';
import { withRequestDatabase } from '@/shared/db/request';

interface Props {
  params: Promise<{ tenant: string; section: string }>;
}

export default async function StandalonePublicSiteSectionPage(props: Props) {
  return withRequestDatabase(() => PublicSiteSectionPage(props));
}
