import PublicSiteControlPage from '@/app/(tenant)/t/[tenant]/admin/platform-control/public-site/page';
import { withRequestDatabase } from '@/shared/db/request';

interface Props {
  params: Promise<{ tenant: string }>;
}

export default async function StandalonePublicSiteControlPage(props: Props) {
  return withRequestDatabase(() => PublicSiteControlPage(props));
}
