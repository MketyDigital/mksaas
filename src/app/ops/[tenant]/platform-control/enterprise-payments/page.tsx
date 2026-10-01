import EnterprisePaymentsPage from '@/app/(tenant)/t/[tenant]/admin/platform-control/enterprise-payments/page';
import { withRequestDatabase } from '@/shared/db/request';

interface Props {
  params: Promise<{ tenant: string }>;
}

export default async function StandaloneEnterprisePaymentsPage(props: Props) {
  return withRequestDatabase(() => EnterprisePaymentsPage(props));
}
