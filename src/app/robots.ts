import type { MetadataRoute } from 'next';

import { getMketyRobotsPolicy } from '@/features/platform-content/indexing';

export default function robots(): MetadataRoute.Robots {
  return getMketyRobotsPolicy();
}
