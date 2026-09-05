import { MketyHomePage } from '@/features/platform-content/components/public/MketyHomePage';
import { getPublishedHomepageContent } from '@/features/platform-content/server/queries';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const content = await getPublishedHomepageContent();

  return <MketyHomePage content={content} />;
}
