import postgres from 'postgres';

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Missing promotion setting: ' + name);
  return value;
}

const databaseUrl = required('AI_PROMOTION_DATABASE_URL');
const action = required('AI_PROMOTION_ACTION');
const confirmation = required('AI_PROMOTION_CONFIRMATION');
if (action !== 'enable' && action !== 'disable') throw new Error('AI_PROMOTION_ACTION must be enable or disable.');

if (action === 'enable') {
  if (confirmation !== 'ENABLE_ENTERPRISE_AI_PRODUCTION') throw new Error('Production enablement confirmation phrase is incorrect.');
  for (const name of ['AI_PROMOTION_BENCHMARK_EVIDENCE','AI_PROMOTION_COMMERCIAL_EVIDENCE','AI_PROMOTION_DOMAIN_EVIDENCE','AI_PROMOTION_REGISTRAR_EVIDENCE']) required(name);
} else {
  if (confirmation !== 'DISABLE_ENTERPRISE_AI_PRODUCTION') throw new Error('Production disable confirmation phrase is incorrect.');
}

const sql = postgres(databaseUrl, { max: 1, prepare: false });
try {
  const policyRows = await sql.unsafe("select key, prepaid_only, customer_inference_enabled from saas_template.ai_runtime_policies where key = 'enterprise-default'");
  const policy = policyRows[0];
  if (!policy) throw new Error('enterprise-default runtime policy does not exist; refusing implicit creation during promotion.');
  if (policy.prepaid_only !== true) throw new Error('Enterprise AI prepaid-only invariant is not active.');

  if (action === 'enable') {
    const readiness = await sql.unsafe("select a.alias, m.provider_key, m.native_model, m.enabled, m.status, r.enabled as route_enabled, exists(select 1 from saas_template.ai_rate_cards rc where rc.model_id=m.id and rc.status='active' and rc.effective_from<=now() and (rc.effective_to is null or rc.effective_to>now())) as active_rate from saas_template.ai_model_aliases a join saas_template.ai_models m on m.id=a.model_id left join saas_template.ai_routes r on r.model_alias=a.alias and r.tenant_id is null and r.project_id is null and r.enabled=true where a.alias in ('mkety-economy','mkety-smart') order by a.alias");
    const byAlias = new Map(readiness.map((row) => [String(row.alias), row]));
    for (const alias of ['mkety-economy','mkety-smart']) {
      const row = byAlias.get(alias);
      if (!row) throw new Error('Missing managed model alias readiness: ' + alias);
      if (row.provider_key !== 'workers-ai' || row.enabled !== true || row.route_enabled !== true || row.active_rate !== true) {
        throw new Error('Managed production readiness failed for ' + alias + '.');
      }
    }
  }

  const desired = action === 'enable';
  await sql.unsafe("update saas_template.ai_runtime_policies set customer_inference_enabled = " + (desired ? 'true' : 'false') + ", updated_at = now() where key = 'enterprise-default'");
  const verifyRows = await sql.unsafe("select customer_inference_enabled, prepaid_only, updated_at from saas_template.ai_runtime_policies where key='enterprise-default'");
  const verify = verifyRows[0];
  if (!verify || verify.customer_inference_enabled !== desired || verify.prepaid_only !== true) throw new Error('Runtime policy promotion verification failed.');

  console.log(JSON.stringify({
    ok: true,
    action,
    customerInferenceEnabled: verify.customer_inference_enabled,
    prepaidOnly: verify.prepaid_only,
    updatedAt: verify.updated_at,
    evidence: action === 'enable' ? {
      benchmark: process.env.AI_PROMOTION_BENCHMARK_EVIDENCE,
      commercial: process.env.AI_PROMOTION_COMMERCIAL_EVIDENCE,
      domain: process.env.AI_PROMOTION_DOMAIN_EVIDENCE,
      registrar: process.env.AI_PROMOTION_REGISTRAR_EVIDENCE,
    } : undefined,
  }, null, 2));
} finally {
  await sql.end();
}
