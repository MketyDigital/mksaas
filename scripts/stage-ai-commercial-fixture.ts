import { createHash, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import postgres from 'postgres';

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Missing required staging acceptance setting: ' + name);
  return value;
}

const action = process.argv[2];
if (action !== 'setup' && action !== 'cleanup') {
  throw new Error('Usage: tsx scripts/stage-ai-commercial-fixture.ts setup|cleanup');
}

const databaseUrl = required('AI_ACCEPTANCE_DATABASE_URL');
const statePath = process.env.AI_ACCEPTANCE_FIXTURE_STATE || '/tmp/mkety-ai-commercial-fixture.json';
const sql = postgres(databaseUrl, { max: 1, prepare: false });

try {
  if (action === 'setup') {
    const suffix = Date.now().toString(36) + '-' + randomUUID().slice(0, 8);
    const slug = 'ai-accept-' + suffix;
    const apiKey = 'mk_ai_test_' + randomBytes(32).toString('hex');
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const keyPrefix = apiKey.slice(0, 24);

    const aliasRows = await sql.unsafe(
      "select a.alias,m.id as model_id,m.native_model,m.provider_key,m.enabled,m.status " +
      "from saas_template.ai_model_aliases a join saas_template.ai_models m on m.id=a.model_id " +
      "where a.alias='mkety-economy'"
    );
    const alias = aliasRows[0];
    if (!alias) throw new Error('mkety-economy alias is missing; managed-model migration has not been applied.');
    if (alias.provider_key !== 'workers-ai' || alias.enabled !== true || alias.status !== 'active') {
      throw new Error('mkety-economy model is not active Workers AI.');
    }

    const routeRows = await sql.unsafe(
      "select id from saas_template.ai_routes where tenant_id is null and project_id is null " +
      "and model_alias='mkety-economy' and enabled=true order by priority asc limit 1"
    );
    if (!routeRows[0]) throw new Error('Global mkety-economy managed route is not enabled.');

    const policyRows = await sql.unsafe(
      "select customer_inference_enabled,prepaid_only from saas_template.ai_runtime_policies where key='enterprise-default'"
    );
    const policy = policyRows[0];
    if (!policy || policy.prepaid_only !== true) {
      throw new Error('Enterprise AI staging policy is missing or not prepaid-only.');
    }

    let rateRows = await sql.unsafe(
      "select id,version from saas_template.ai_rate_cards where model_id='" + String(alias.model_id) +
      "'::uuid and status='active' and effective_from<=now() and (effective_to is null or effective_to>now()) " +
      "order by version desc limit 1"
    );
    let rateCardId = rateRows[0]?.id ? String(rateRows[0].id) : null;
    let createdRateCard = false;

    if (!rateCardId) {
      const version = 900000000 + (Math.floor(Date.now() / 1000) % 99999999);
      rateRows = await sql.unsafe(
        "insert into saas_template.ai_rate_cards " +
        "(model_id,version,status,input_credits_per_million,cached_input_credits_per_million," +
        "output_credits_per_million,minimum_credits_per_request,effective_from) values ('" +
        String(alias.model_id) + "'::uuid," + version + ",'active',300,300,900,1,now()-interval '1 minute') " +
        "returning id,version"
      );
      rateCardId = String(rateRows[0].id);
      createdRateCard = true;
    }

    const tenantRows = await sql.unsafe(
      "insert into saas_template.tenants (slug,name,description,settings) values ('" + slug +
      "','Mkety AI Acceptance','Ephemeral non-production commercial AI acceptance','{}') returning id"
    );
    const tenantId = String(tenantRows[0].id);

    for (const entitlement of ['workspace.ai.enterprise', 'ai.api']) {
      await sql.unsafe(
        "insert into saas_template.tenant_entitlement_overrides " +
        "(tenant_id,entitlement_key,effect,reason,source,expires_at) values ('" + tenantId +
        "'::uuid,'" + entitlement + "','grant','Ephemeral staging commercial acceptance','ai-acceptance'," +
        "now()+interval '30 minutes')"
      );
    }

    const apiRows = await sql.unsafe(
      "insert into saas_template.ai_api_keys " +
      "(tenant_id,environment,name,key_prefix,key_hash,scopes,expires_at) values ('" + tenantId +
      "'::uuid,'test','Ephemeral acceptance','" + keyPrefix + "','" + keyHash +
      "','[\"ai:chat\"]'::jsonb,now()+interval '30 minutes') returning id"
    );
    const apiKeyId = String(apiRows[0].id);

    await sql.unsafe(
      "insert into saas_template.tenant_credit_accounts " +
      "(tenant_id,available_credits,lifetime_granted,lifetime_consumed) values ('" +
      tenantId + "'::uuid,1000000,1000000,0)"
    );
    await sql.unsafe(
      "insert into saas_template.credit_ledger_entries " +
      "(tenant_id,delta,entry_type,source,idempotency_key,reason) values ('" +
      tenantId + "'::uuid,1000000,'manual_grant','ai-acceptance','fixture-grant-" +
      suffix + "','Ephemeral staging acceptance credits')"
    );
    await sql.unsafe(
      "insert into saas_template.ai_budgets " +
      "(tenant_id,api_key_id,period,max_credits,max_requests,used_credits,used_requests,reserved_credits," +
      "reserved_requests,hard_stop,starts_at,ends_at) values ('" + tenantId + "'::uuid,'" +
      apiKeyId + "'::uuid,'acceptance',1000000,10,0,0,0,0,true,now()-interval '1 minute'," +
      "now()+interval '30 minutes')"
    );

    await sql.unsafe(
      "update saas_template.ai_runtime_policies set customer_inference_enabled=true,updated_at=now() " +
      "where key='enterprise-default'"
    );

    const state = {
      tenantId,
      slug,
      apiKey,
      apiKeyId,
      modelAlias: 'mkety-economy',
      nativeModel: String(alias.native_model),
      rateCardId,
      createdRateCard,
      previousCustomerInferenceEnabled: Boolean(policy.customer_inference_enabled),
    };
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.log(JSON.stringify(state, null, 2));
  } else {
    if (!fs.existsSync(statePath)) {
      console.log(JSON.stringify({ ok: true, cleanup: 'nothing-to-do' }));
      process.exit(0);
    }

    const state = JSON.parse(fs.readFileSync(statePath, 'utf8')) as {
      tenantId: string;
      rateCardId?: string | null;
      createdRateCard?: boolean;
      previousCustomerInferenceEnabled?: boolean;
    };
    if (!/^[0-9a-f-]{36}$/i.test(state.tenantId)) throw new Error('Fixture tenant id is invalid.');

    await sql.unsafe(
      "update saas_template.ai_runtime_policies set customer_inference_enabled=" +
      (state.previousCustomerInferenceEnabled ? 'true' : 'false') +
      ",updated_at=now() where key='enterprise-default'"
    );
    await sql.unsafe("delete from saas_template.tenants where id='" + state.tenantId + "'::uuid");

    if (state.createdRateCard && state.rateCardId && /^[0-9a-f-]{36}$/i.test(state.rateCardId)) {
      await sql.unsafe("delete from saas_template.ai_rate_cards where id='" + state.rateCardId + "'::uuid");
    }

    fs.rmSync(statePath, { force: true });
    console.log(JSON.stringify({ ok: true, cleanup: 'restored', tenantId: state.tenantId }));
  }
} finally {
  await sql.end();
}
