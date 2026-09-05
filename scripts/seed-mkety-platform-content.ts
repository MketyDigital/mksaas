/**
 * Mkety Platform Content Seed Script
 *
 * Seeds the published Mkety public website/docs defaults and global app experience defaults.
 * Run after CMS migrations are applied:
 *
 *   pnpm db:migrate
 *   pnpm db:seed:mkety-content
 *
 * The seed functions are intentionally idempotent and must not overwrite admin-managed content.
 */

import { seedDefaultPlatformAppExperience } from '../src/features/platform-app-experience/server/seed';
import { seedDefaultPlatformContent } from '../src/features/platform-content/server/seed';

async function main() {
  console.log('🌱 Seeding Mkety platform content...');

  const publicContent = await seedDefaultPlatformContent();
  console.log('✅ Public website/docs seed result:', publicContent);

  const appExperience = await seedDefaultPlatformAppExperience();
  console.log('✅ App experience seed result:', appExperience);

  console.log('\n🎉 Mkety platform content seed complete.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Mkety platform content seed failed:', error);
    process.exit(1);
  });
