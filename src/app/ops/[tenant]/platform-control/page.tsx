import PlatformControlPage from '@/app/(tenant)/t/[tenant]/admin/platform-control/page';
import { withRequestDatabase } from '@/shared/db/request';

interface Props {
  params: Promise<{ tenant: string }>;
}

export default async function StandalonePlatformControlPage(props: Props) {
  return withRequestDatabase(() => PlatformControlPage(props));
}
