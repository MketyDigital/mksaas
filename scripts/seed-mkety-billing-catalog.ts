import { seedSelfServiceBillingCatalog } from '../src/features/billing/server/catalog-seed';

async function main() {
  console.log('🌱 Seeding Mkety self-service billing catalog...');
  const result = await seedSelfServiceBillingCatalog();
  console.log('✅ Mkety billing catalog seed result:', result);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Mkety billing catalog seed failed:', error);
    process.exit(1);
  });
