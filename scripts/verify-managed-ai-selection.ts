import postgres from 'postgres';

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Missing required database setting: ' + name);
  return value;
}

const databaseUrl = required('DATABASE_URL');
const sql = postgres(databaseUrl, { max: 1, prepare: false });

try {
  const aliases = await sql.unsafe(
    "select a.alias,m.provider_key,m.native_model,m.enabled,m.status " +
    "from saas_template.ai_model_aliases a join saas_template.ai_models m on m.id=a.model_id " +
    "where a.alias in ('mkety-economy','mkety-smart') order by a.alias"
  );

  const byAlias = new Map(aliases.map((row) => [String(row.alias), row]));
  const economy = byAlias.get('mkety-economy');
  const smart = byAlias.get('mkety-smart');

  if (!economy) throw new Error('mkety-economy alias is missing.');
  if (!smart) throw new Error('mkety-smart alias is missing.');

  if (
    economy.provider_key !== 'workers-ai' ||
    economy.native_model !== '@cf/google/gemma-4-26b-a4b-it' ||
    economy.enabled !== true ||
    economy.status !== 'active'
  ) {
    throw new Error('mkety-economy is not the active Gemma 4 managed route target.');
  }

  if (
    smart.provider_key !== 'workers-ai' ||
    smart.native_model !== '@cf/zai-org/glm-5.3-flash' ||
    smart.enabled !== true ||
    smart.status !== 'active'
  ) {
    throw new Error('mkety-smart is not the active GLM-5.3 Flash managed route target.');
  }

  const reserveRows = await sql.unsafe(
    "select provider_key,native_model,enabled,status from saas_template.ai_models " +
    "where provider_key='workers-ai' and native_model='@cf/qwen/qwen3.8-27b'"
  );
  const reserve = reserveRows[0];
  if (!reserve || reserve.enabled !== false || reserve.status !== 'benchmarked-reserve') {
    throw new Error('Qwen 3.8 27B is not preserved as a disabled reserve model.');
  }

  const routes = await sql.unsafe(
    "select model_alias,enabled,priority from saas_template.ai_routes " +
    "where tenant_id is null and project_id is null and model_alias in ('mkety-economy','mkety-smart')"
  );
  const active = new Set(routes.filter((row) => row.enabled === true).map((row) => String(row.model_alias)));
  for (const alias of ['mkety-economy', 'mkety-smart']) {
    if (!active.has(alias)) throw new Error('Missing enabled global AI route for ' + alias + '.');
  }

  console.log(JSON.stringify({
    ok: true,
    economy: { alias: 'mkety-economy', nativeModel: economy.native_model },
    smart: { alias: 'mkety-smart', nativeModel: smart.native_model },
    reserve: { nativeModel: reserve.native_model, enabled: reserve.enabled, status: reserve.status },
  }, null, 2));
} finally {
  await sql.end();
}
