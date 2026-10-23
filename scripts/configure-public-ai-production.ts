import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const routing = {
  enabled: true,
  primaryProvider: 'azure-openai',
  fallbackProviders: ['workers-ai'],
  models: {
    'azure-openai': 'gpt-6-luna-1',
    'workers-ai': '@cf/google/gemma-4-26b-a4b-it',
  },
};

const sql = postgres(databaseUrl, { max: 1, prepare: false });
try {
  const configured = await sql.begin(async (tx) => {
    const rows = await tx.unsafe(
      "SELECT id, metadata_json FROM saas_template.platform_app_control_center_modules WHERE module_key = 'ai-operations' FOR UPDATE",
    );

    if (rows.length === 0) return false;
    if (rows.length !== 1) throw new Error('AI Operations control module is not unique.');

    const currentRaw = rows[0].metadata_json;
    const current =
      typeof currentRaw === 'string'
        ? JSON.parse(currentRaw)
        : currentRaw && typeof currentRaw === 'object' && !Array.isArray(currentRaw)
          ? currentRaw
          : {};
    const next = { ...current, publicAiConfig: routing };
    const before = JSON.stringify({ publicAiConfig: current.publicAiConfig ?? null });
    const after = JSON.stringify({ publicAiConfig: routing });

    await tx.unsafe(
      'UPDATE saas_template.platform_app_control_center_modules SET metadata_json = $1::jsonb, updated_at = now() WHERE id = $2',
      [JSON.stringify(next), rows[0].id],
    );
    await tx.unsafe(
      'INSERT INTO saas_template.platform_app_experience_revisions (entity_type, entity_id, before_json, after_json, actor_id) VALUES ($1, $2, $3::jsonb, $4::jsonb, NULL)',
      ['control_center_module', rows[0].id, before, after],
    );
    return true;
  });

  console.log(
    configured
      ? 'MKETY_PUBLIC_AI_ROUTING_CONFIG=enabled azure-openai with workers-ai fallback'
      : 'MKETY_PUBLIC_AI_ROUTING_CONFIG=control-module-absent; environment routing remains enabled',
  );
} finally {
  await sql.end({ timeout: 5 });
}
