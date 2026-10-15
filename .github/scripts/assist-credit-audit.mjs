/**
 * Read-only Starpips Assist D1 audit. Queries return aggregate usage, billing,
 * routing, prompt-size and error metadata only. Never select message/prompt text.
 */
export function validateAuditInput(customerId, days) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(String(customerId || ""))) throw new Error("Invalid customer id");
  const range = Number(days);
  if (!Number.isInteger(range) || range < 1 || range > 90) throw new Error("Days must be an integer from 1 to 90");
  return { customerId: String(customerId), days: range };
}

const cutoff = (days) => `unixepoch('now','-${days} days')`;
const q = (sql) => ({ sql, params: [] });

export function buildCreditAuditQueries(customerId, days = 30) {
  const input = validateAuditInput(customerId, days);
  const id = `(SELECT id FROM customers WHERE lower(slug)='${input.customerId}' LIMIT 1)`;
  const since = cutoff(input.days);
  return [
    q(`SELECT c.id AS customer_id,c.slug,c.status,a.balance,a.lifetime_granted,a.lifetime_consumed,cp.included_credits,cp.rate_multiplier_bps,cp.media_rate_multiplier_bps,cp.provider_envelope_bps,cp.operations_reserve_bps FROM customers c LEFT JOIN credit_accounts a ON a.customer_id=c.id LEFT JOIN commercial_policy cp ON cp.customer_id=c.id WHERE c.id=${id};`),
    q(`SELECT date(created_at,'unixepoch') AS day,kind,COUNT(*) AS entries,SUM(delta) AS delta_atoms,SUM(CASE WHEN delta<0 THEN -delta ELSE 0 END) AS debited_atoms FROM credit_ledger WHERE customer_id=${id} AND created_at>=${since} GROUP BY day,kind ORDER BY day,kind;`),
    q(`SELECT date(created_at,'unixepoch') AS day,COALESCE(provider,'unknown') AS provider,COALESCE(provider_model,'unknown') AS provider_model,COALESCE(model_alias,'unknown') AS model_alias,COUNT(*) AS calls,SUM(input_units) AS input_units,SUM(output_units) AS output_units,SUM(reasoning_units) AS reasoning_units,SUM(credits_charged) AS credits_atoms,SUM(provider_cost_micros) AS provider_cost_micros FROM usage_events WHERE customer_id=${id} AND created_at>=${since} GROUP BY day,provider,provider_model,model_alias ORDER BY day,credits_atoms DESC;`),
    q(`SELECT status,COUNT(*) AS reservations,SUM(reserved_credits) AS reserved_atoms,SUM(COALESCE(settled_credits,0)) AS settled_atoms,MIN(created_at) AS oldest_created_at,MAX(created_at) AS newest_created_at FROM credit_reservations WHERE customer_id=${id} GROUP BY status;`),
    q(`SELECT date(created_at,'unixepoch') AS day,status,COUNT(*) AS reservations,SUM(reserved_credits) AS reserved_atoms,SUM(COALESCE(settled_credits,0)) AS settled_atoms FROM credit_reservations WHERE customer_id=${id} AND created_at>=${since} GROUP BY day,status ORDER BY day,status;`),
    q(`SELECT status,COUNT(*) AS attempts,MIN(updated_at) AS oldest_updated_at,MAX(updated_at) AS newest_updated_at,SUM(COALESCE(input_units,0)) AS input_units,SUM(COALESCE(output_units,0)) AS output_units,SUM(COALESCE(reasoning_units,0)) AS reasoning_units,SUM(COALESCE(provider_cost_micros,0)) AS provider_cost_micros FROM inference_attempt_index WHERE customer_id=${id} AND started_at>=${since} GROUP BY status ORDER BY status;`),
    q(`SELECT status,COUNT(*) AS attempts,MIN(updated_at) AS oldest_updated_at,MAX(updated_at) AS newest_updated_at,SUM(COALESCE(input_units,0)) AS input_units,SUM(COALESCE(output_units,0)) AS output_units,SUM(COALESCE(reasoning_units,0)) AS reasoning_units,SUM(COALESCE(provider_cost_micros,0)) AS provider_cost_micros FROM workload_inference_attempt_index WHERE customer_id=${id} AND started_at>=${since} GROUP BY status ORDER BY status;`),
    q(`SELECT 'assistant_usage' AS source,COUNT(*) AS rows,SUM(credits_charged) AS credits_atoms,SUM(provider_cost_micros) AS provider_cost_micros FROM usage_events WHERE customer_id=${id} AND created_at>=${since} UNION ALL SELECT 'provider_cost_events',COUNT(*),NULL,SUM(cost_micros) FROM provider_cost_events WHERE customer_id=${id} AND created_at>=${since};`),
    q(`SELECT status,COALESCE(last_error,'(none)') AS error_code,COUNT(*) AS jobs,MIN(created_at) AS first_created_at,MAX(updated_at) AS last_updated_at,SUM(attempts) AS delivery_attempts,SUM(image_count) AS image_count,SUM(audio_seconds) AS audio_seconds FROM reply_jobs WHERE customer_id=${id} AND created_at>=${since} GROUP BY status,error_code ORDER BY jobs DESC LIMIT 100;`),
    q(`SELECT a.id AS assistant_id,a.status,a.model_alias,a.reasoning_mode,a.reasoning_fallback_policy,a.monthly_credit_cap,p.version AS published_prompt_version,length(p.instructions) AS prompt_characters,(SELECT COUNT(*) FROM assistant_knowledge ak WHERE ak.assistant_id=a.id) AS knowledge_collections FROM assistants a LEFT JOIN assistant_prompt_versions p ON p.assistant_id=a.id AND p.customer_id=a.customer_id AND p.status='published' WHERE a.customer_id=${id} ORDER BY a.created_at;`),
    q(`SELECT role,COUNT(*) AS messages,MIN(created_at) AS first_created_at,MAX(created_at) AS last_created_at FROM messages WHERE customer_id=${id} AND created_at>=${since} GROUP BY role ORDER BY role;`),
    q(`SELECT alias,provider,provider_model,enabled,COUNT(*) AS route_targets,MIN(position) AS first_position,MIN(input_credits_per_million) AS min_input_rate,MAX(input_credits_per_million) AS max_input_rate,MIN(output_credits_per_million) AS min_output_rate,MAX(output_credits_per_million) AS max_output_rate,MIN(image_credits) AS min_image_rate,MAX(image_credits) AS max_image_rate,MIN(audio_credits_per_minute) AS min_audio_rate,MAX(audio_credits_per_minute) AS max_audio_rate,MAX(provider_input_cost_micros_per_million) AS provider_input_cost_micros_per_million,MAX(provider_output_cost_micros_per_million) AS provider_output_cost_micros_per_million,MAX(provider_image_cost_micros) AS provider_image_cost_micros,MAX(provider_audio_cost_micros_per_minute) AS provider_audio_cost_micros_per_minute FROM model_route_targets WHERE customer_id=${id} OR customer_id IS NULL GROUP BY alias,provider,provider_model,enabled ORDER BY alias,first_position;`),
    q(`SELECT alias,version,input_credits_per_million,output_credits_per_million,image_credits,audio_credits_per_minute,provider_input_cost_micros_per_million,provider_output_cost_micros_per_million,provider_image_cost_micros,provider_audio_cost_micros_per_minute,created_at FROM model_rates WHERE version=(SELECT MAX(m2.version) FROM model_rates m2 WHERE m2.alias=model_rates.alias) ORDER BY alias;`),
    q(`SELECT name AS migration_name,applied_at FROM d1_migrations WHERE name IN ('0031_true_mkredit_precision.sql','0032_exact_provider_rate_reconciliation.sql','0033_mkredit_public_unit.sql','0042_provider_base_media_pricing.sql','0043_media_voice_rate_multiplier.sql','0044_gpt6_luna_primary_remove_sol.sql') ORDER BY name;`),
    q(`SELECT COUNT(*) AS recent_duplicate_attempt_groups,SUM(calls-1) AS extra_usage_rows FROM (SELECT provider_attempt_id,COUNT(*) AS calls FROM usage_events WHERE customer_id=${id} AND created_at>=${since} AND provider_attempt_id IS NOT NULL GROUP BY provider_attempt_id HAVING COUNT(*)>1);`),
    q(`SELECT 'assistant' AS workload_type,COALESCE(status,'(null)') AS status,COUNT(*) AS attempts FROM inference_attempt_index WHERE customer_id=${id} AND started_at>=${since} GROUP BY status UNION ALL SELECT 'api_key',COALESCE(status,'(null)'),COUNT(*) FROM workload_inference_attempt_index WHERE customer_id=${id} AND started_at>=${since} GROUP BY status;`),
  ];
}

export function renderCreditAudit({ customerId, days, generatedAt = new Date().toISOString(), results }) {
  return {
    reportType: "mkety-assist-starpips-credit-audit",
    customerId,
    days,
    generatedAt,
    readOnly: true,
    privacy: "Aggregate billing, usage, route, prompt-length and error metadata only. No message, prompt, transcript, credential, or media content.",
    sections: Object.fromEntries(results.map((r) => [r.name, r.rows || []])),
  };
}
