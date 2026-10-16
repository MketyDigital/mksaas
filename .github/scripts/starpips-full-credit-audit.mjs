import { createCipheriv, publicEncrypt, randomBytes, constants } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const CUSTOMER_SLUG = "starpips";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const PUBLIC_KEY_PATH = join(scriptDir, "starpips-audit-public.pem");

const customerId = `(SELECT id FROM customers WHERE lower(slug)='${CUSTOMER_SLUG}' LIMIT 1)`;
const since = "unixepoch('now','-15 minutes')";
const query = (name, sql) => ({ name, sql: sql.trim(), params: [] });

export function buildFullCreditAuditQueries() {
  const candidates = [
    query("customer_account", `
      SELECT c.id AS customer_id,c.slug,c.status,a.balance,a.lifetime_granted,a.lifetime_consumed,
        cp.included_credits,cp.rate_multiplier_bps,cp.media_rate_multiplier_bps,
        cp.provider_envelope_bps,cp.operations_reserve_bps,
        s.enabled AS raw_api_enabled,s.allowed_models_json,s.updated_at AS raw_api_settings_updated_at
      FROM customers c
      LEFT JOIN credit_accounts a ON a.customer_id=c.id
      LEFT JOIN commercial_policy cp ON cp.customer_id=c.id
      LEFT JOIN raw_model_api_settings s ON s.customer_id=c.id
      WHERE lower(c.slug)='${CUSTOMER_SLUG}'
    `),
    query("required_migrations", `
      SELECT name AS migration_name,applied_at FROM d1_migrations
      WHERE name IN (
        '0031_true_mkredit_precision.sql','0032_exact_provider_rate_reconciliation.sql',
        '0033_mkredit_public_unit.sql','0039_raw_model_api_opt_in.sql',
        '0042_provider_base_media_pricing.sql','0043_media_voice_rate_multiplier.sql',
        '0044_gpt6_luna_primary_remove_sol.sql'
      ) ORDER BY name
    `),
    query("all_credit_ledger_by_day_and_kind", `
      SELECT date(created_at,'unixepoch') AS day,COALESCE(kind,'(null)') AS kind,
        COALESCE(workload_type,'(null)') AS workload_type,COUNT(*) AS entries,
        SUM(delta) AS net_delta_atoms,
        SUM(CASE WHEN delta<0 THEN -delta ELSE 0 END) AS debit_atoms,
        SUM(CASE WHEN delta>0 THEN delta ELSE 0 END) AS credit_atoms
      FROM credit_ledger WHERE customer_id=${customerId}
      GROUP BY day,kind,workload_type ORDER BY day,kind,workload_type
    `),
    query("all_credit_ledger_details", `
      SELECT id AS ledger_id,assistant_id,workload_type,workload_id,
        substr(COALESCE(workload_id,''),1,6)||'…'||substr(COALESCE(workload_id,''),-4) AS workload_id_masked,
        delta,kind,reference_id,balance_after,created_at
      FROM credit_ledger WHERE customer_id=${customerId} ORDER BY created_at,id
    `),
    query("account_vs_all_ledger", `
      SELECT a.balance,a.lifetime_granted,a.lifetime_consumed,
        COALESCE(SUM(l.delta),0) AS all_time_ledger_delta_atoms,
        a.balance-COALESCE(SUM(l.delta),0) AS balance_minus_ledger_delta_atoms,
        COUNT(l.id) AS ledger_rows
      FROM credit_accounts a LEFT JOIN credit_ledger l ON l.customer_id=a.customer_id
      WHERE a.customer_id=${customerId} GROUP BY a.customer_id
    `),
    query("assistant_reservations_by_status", `
      SELECT status,COUNT(*) AS reservations,SUM(reserved_credits) AS reserved_atoms,
        SUM(COALESCE(settled_credits,0)) AS settled_atoms,
        MIN(created_at) AS oldest_created_at,MAX(created_at) AS newest_created_at
      FROM credit_reservations WHERE customer_id=${customerId} GROUP BY status ORDER BY status
    `),
    query("assistant_reservation_details", `
      SELECT id AS reservation_id,assistant_id,reserved_credits,status,settled_credits,created_at
      FROM credit_reservations WHERE customer_id=${customerId} ORDER BY created_at,id
    `),
    query("assistant_attempt_details", `
      SELECT attempt_id,assistant_id,reservation_id,reply_job_id,model_alias,media_kind,provider,model,status,
        started_at,updated_at,input_units,output_units,reasoning_units,image_units,audio_seconds,
        provider_cost_micros,requested_reasoning_mode,applied_reasoning_mode,resolved_at
      FROM inference_attempt_index WHERE customer_id=${customerId} ORDER BY started_at,attempt_id
    `),
    query("assistant_usage_by_day_and_route", `
      SELECT date(created_at,'unixepoch') AS day,COALESCE(provider,'unknown') AS provider,
        COALESCE(provider_model,'unknown') AS provider_model,COALESCE(model_alias,'unknown') AS model_alias,
        COUNT(*) AS calls,SUM(input_units) AS input_units,SUM(output_units) AS output_units,
        SUM(reasoning_units) AS reasoning_units,SUM(credits_charged) AS credits_atoms,
        SUM(provider_cost_micros) AS provider_cost_micros
      FROM usage_events WHERE customer_id=${customerId}
      GROUP BY day,provider,provider_model,model_alias ORDER BY day,credits_atoms DESC
    `),
    query("raw_api_reservations_by_status", `
      SELECT status,COUNT(*) AS reservations,SUM(reserved_credits) AS reserved_atoms,
        SUM(COALESCE(settled_credits,0)) AS settled_atoms,
        MIN(created_at) AS oldest_created_at,MAX(created_at) AS newest_created_at,
        SUM(CASE WHEN status='open' AND created_at<${since} THEN 1 ELSE 0 END) AS stale_open_reservations
      FROM raw_model_reservations WHERE customer_id=${customerId} GROUP BY status ORDER BY status
    `),
    query("raw_api_reservations_by_day", `
      SELECT date(created_at,'unixepoch') AS day,status,COUNT(*) AS reservations,
        SUM(reserved_credits) AS reserved_atoms,SUM(COALESCE(settled_credits,0)) AS settled_atoms
      FROM raw_model_reservations WHERE customer_id=${customerId}
      GROUP BY day,status ORDER BY day,status
    `),
    query("raw_api_reservation_details", `
      SELECT id AS reservation_id,api_key_id,reserved_credits,status,settled_credits,
        created_at,settled_at,(idempotency_key IS NOT NULL) AS has_idempotency_key,
        (resolution_token IS NOT NULL) AS has_resolution_token
      FROM raw_model_reservations WHERE customer_id=${customerId} ORDER BY created_at,id
    `),
    query("raw_api_attempts_by_day_route_status", `
      SELECT date(started_at,'unixepoch') AS day,COALESCE(provider,'unknown') AS provider,
        COALESCE(model,'unknown') AS provider_model,COALESCE(model_alias,'unknown') AS model_alias,
        status,COUNT(*) AS attempts,SUM(COALESCE(input_units,0)) AS input_units,
        SUM(COALESCE(output_units,0)) AS output_units,SUM(COALESCE(reasoning_units,0)) AS reasoning_units,
        SUM(COALESCE(provider_cost_micros,0)) AS provider_cost_micros,
        MIN(updated_at) AS oldest_updated_at,MAX(updated_at) AS newest_updated_at
      FROM workload_inference_attempt_index WHERE customer_id=${customerId}
      GROUP BY day,provider,provider_model,model_alias,status ORDER BY day,attempts DESC
    `),
    query("raw_api_attempt_details", `
      SELECT attempt_id,reservation_id,workload_id,substr(workload_id,1,6)||'…'||substr(workload_id,-4) AS workload_id_masked,
        request_hash,model_alias,provider,model,status,started_at,updated_at,input_units,output_units,reasoning_units,
        provider_cost_micros,rate_snapshot_json,requested_reasoning_mode,applied_reasoning_mode,
        (resolution_usage_json IS NOT NULL) AS has_resolution_usage,
        length(resolution_usage_json) AS resolution_usage_json_length,
        (resolution_idempotency_key IS NOT NULL) AS has_resolution_idempotency_key,resolved_at
      FROM workload_inference_attempt_index WHERE customer_id=${customerId} ORDER BY started_at,attempt_id
    `),
    query("raw_api_settlements_by_status", `
      SELECT status,COUNT(*) AS settlements,SUM(actual_credits) AS actual_credit_atoms,
        MIN(created_at) AS oldest_created_at,MAX(created_at) AS newest_created_at,
        MAX(applied_at) AS newest_applied_at
      FROM raw_model_settlements WHERE customer_id=${customerId} GROUP BY status ORDER BY status
    `),
    query("raw_api_settlement_details", `
      SELECT reservation_id,customer_id,api_key_id,status,actual_credits,created_at,applied_at
      FROM raw_model_settlements WHERE customer_id=${customerId} ORDER BY created_at,reservation_id
    `),
    query("all_usage_by_day_workload_route", `
      SELECT date(created_at,'unixepoch') AS day,COALESCE(workload_type,'assistant') AS workload_type,
        COALESCE(provider,'unknown') AS provider,COALESCE(provider_model,'unknown') AS provider_model,
        COALESCE(model_alias,'unknown') AS model_alias,COUNT(*) AS usage_rows,
        SUM(COALESCE(input_units,0)) AS input_units,SUM(COALESCE(output_units,0)) AS output_units,
        SUM(COALESCE(reasoning_units,0)) AS reasoning_units,SUM(COALESCE(credits_charged,0)) AS credits_atoms,
        SUM(COALESCE(provider_cost_micros,0)) AS provider_cost_micros,
        SUM(CASE WHEN provider_attempt_id IS NULL THEN 1 ELSE 0 END) AS rows_without_provider_attempt_id
      FROM usage_events WHERE customer_id=${customerId}
      GROUP BY day,workload_type,provider,provider_model,model_alias ORDER BY day,credits_atoms DESC
    `),
    query("all_usage_event_details", `
      SELECT id AS usage_event_id,assistant_id,workload_type,workload_id,
        substr(COALESCE(workload_id,''),1,6)||'…'||substr(COALESCE(workload_id,''),-4) AS workload_id_masked,
        reservation_id,provider_attempt_id,model_alias,provider,provider_model,input_units,output_units,
        reasoning_units,requested_reasoning_mode,applied_reasoning_mode,credits_charged,
        provider_cost_micros,created_at
      FROM usage_events WHERE customer_id=${customerId} ORDER BY created_at,id
    `),
    query("raw_api_usage_event_details", `
      SELECT id AS usage_event_id,reservation_id,provider_attempt_id,model_alias,provider,provider_model,
        input_units,output_units,reasoning_units,credits_charged,provider_cost_micros,created_at
      FROM usage_events WHERE customer_id=${customerId} AND workload_type='api_key'
      ORDER BY created_at,id
    `),
    query("provider_costs_by_day_route", `
      SELECT date(p.created_at,'unixepoch') AS day,COALESCE(p.provider,'unknown') AS provider,
        COALESCE(p.provider_model,'unknown') AS provider_model,COUNT(*) AS events,
        SUM(COALESCE(p.cost_micros,0)) AS provider_cost_micros,
        SUM(CASE WHEN u.id IS NULL THEN 1 ELSE 0 END) AS events_without_usage_row,
        SUM(CASE WHEN p.provider_attempt_id IS NULL THEN 1 ELSE 0 END) AS events_without_attempt_id
      FROM provider_cost_events p LEFT JOIN usage_events u ON u.id=p.usage_event_id AND u.customer_id=p.customer_id
      WHERE p.customer_id=${customerId}
      GROUP BY date(p.created_at,'unixepoch'),COALESCE(p.provider,'unknown'),COALESCE(p.provider_model,'unknown')
      ORDER BY day,provider_cost_micros DESC
    `),
    query("all_provider_cost_event_details", `
      SELECT id AS provider_cost_event_id,usage_event_id,provider_attempt_id,provider,provider_model,
        cost_micros,currency,created_at
      FROM provider_cost_events WHERE customer_id=${customerId} ORDER BY created_at,id
    `),
    query("raw_api_provider_cost_details", `
      SELECT p.id AS provider_cost_event_id,p.usage_event_id,p.provider_attempt_id,p.provider,p.provider_model,
        p.cost_micros,p.currency,p.created_at
      FROM provider_cost_events p LEFT JOIN usage_events u ON u.id=p.usage_event_id AND u.customer_id=p.customer_id
      WHERE p.customer_id=${customerId} AND (u.workload_type='api_key' OR u.id IS NULL)
      ORDER BY p.created_at,p.id
    `),
    query("resolution_audit_by_outcome", `
      SELECT outcome,COUNT(*) AS resolutions,MIN(created_at) AS oldest_created_at,
        MAX(created_at) AS newest_created_at,
        SUM(CASE WHEN length(trim(evidence_summary))>0 THEN 1 ELSE 0 END) AS with_evidence,
        SUM(CASE WHEN length(trim(reason))>0 THEN 1 ELSE 0 END) AS with_reason
      FROM workload_attempt_resolution_audit WHERE attempt_id IN (
        SELECT attempt_id FROM workload_inference_attempt_index WHERE customer_id=${customerId}
      ) GROUP BY outcome ORDER BY outcome
    `),
    query("resolution_audit_details", `
      SELECT a.id AS resolution_audit_id,a.attempt_id,a.outcome,a.evidence_summary,a.reason,
        a.operator_user_id,a.created_at
      FROM workload_attempt_resolution_audit a JOIN workload_inference_attempt_index i ON i.attempt_id=a.attempt_id
      WHERE i.customer_id=${customerId} ORDER BY a.created_at,a.id
    `),
    query("reservation_reconciliation_all", `
      WITH attempts AS (
        SELECT reservation_id,COUNT(*) AS attempt_count,group_concat(DISTINCT status) AS attempt_statuses,
          MAX(updated_at) AS latest_attempt_update,MAX(provider_cost_micros) AS max_attempt_cost_micros
        FROM workload_inference_attempt_index WHERE customer_id=${customerId} GROUP BY reservation_id
      ), settlements AS (
        SELECT reservation_id,COUNT(*) AS settlement_count,MAX(actual_credits) AS actual_credits,
          SUM(CASE WHEN status='applied' THEN 1 ELSE 0 END) AS applied_count,
          SUM(CASE WHEN status='applying' THEN 1 ELSE 0 END) AS applying_count,MAX(applied_at) AS applied_at
        FROM raw_model_settlements WHERE customer_id=${customerId} GROUP BY reservation_id
      ), usage AS (
        SELECT reservation_id,COUNT(*) AS usage_count,SUM(COALESCE(credits_charged,0)) AS usage_credits,
          SUM(COALESCE(provider_cost_micros,0)) AS usage_provider_cost_micros
        FROM usage_events WHERE customer_id=${customerId} AND workload_type='api_key'
          AND reservation_id IS NOT NULL GROUP BY reservation_id
      ), ledger AS (
        SELECT reference_id,COUNT(*) AS ledger_count,SUM(delta) AS ledger_net_delta,
          SUM(CASE WHEN kind='inference_reserve' THEN 1 ELSE 0 END) AS reserve_count,
          SUM(CASE WHEN kind='inference_release' THEN 1 ELSE 0 END) AS release_count,
          SUM(CASE WHEN kind='inference_settlement_refund' THEN 1 ELSE 0 END) AS refund_count
        FROM credit_ledger WHERE customer_id=${customerId} AND reference_id IS NOT NULL
        GROUP BY reference_id
      )
      SELECT r.id AS reservation_id,r.api_key_id,r.status,r.reserved_credits,r.settled_credits,
        r.created_at,r.settled_at,COALESCE(a.attempt_count,0) AS attempt_count,a.attempt_statuses,
        a.latest_attempt_update,COALESCE(s.settlement_count,0) AS settlement_count,
        COALESCE(s.applied_count,0) AS applied_settlement_count,COALESCE(s.applying_count,0) AS applying_settlement_count,
        s.actual_credits AS settlement_actual_credits,s.applied_at,
        COALESCE(u.usage_count,0) AS linked_usage_rows,COALESCE(u.usage_credits,0) AS linked_usage_credit_atoms,
        COALESCE(u.usage_provider_cost_micros,0) AS linked_provider_cost_micros,
        COALESCE(l.ledger_count,0) AS ledger_rows,COALESCE(l.ledger_net_delta,0) AS ledger_net_delta_atoms,
        COALESCE(l.reserve_count,0) AS reserve_ledger_rows,COALESCE(l.release_count,0) AS release_ledger_rows,
        COALESCE(l.refund_count,0) AS refund_ledger_rows,
        CASE r.status WHEN 'open' THEN -r.reserved_credits WHEN 'settled' THEN -COALESCE(r.settled_credits,0) ELSE 0 END AS expected_ledger_net_delta_atoms
      FROM raw_model_reservations r LEFT JOIN attempts a ON a.reservation_id=r.id
      LEFT JOIN settlements s ON s.reservation_id=r.id LEFT JOIN usage u ON u.reservation_id=r.id
      LEFT JOIN ledger l ON l.reference_id=r.id
      WHERE r.customer_id=${customerId} ORDER BY r.created_at,r.id
    `),
    query("reservation_integrity_anomalies", `
      WITH attempts AS (
        SELECT reservation_id,COUNT(*) AS attempt_count,group_concat(DISTINCT status) AS attempt_statuses,
          MAX(updated_at) AS latest_attempt_update,
          SUM(CASE WHEN status IN ('started','unknown_outcome','result_recorded') AND updated_at<${since} THEN 1 ELSE 0 END) AS stale_unresolved_attempts
        FROM workload_inference_attempt_index WHERE customer_id=${customerId} GROUP BY reservation_id
      ), settlements AS (
        SELECT reservation_id,COUNT(*) AS settlement_count,MAX(actual_credits) AS actual_credits,
          SUM(CASE WHEN status='applied' THEN 1 ELSE 0 END) AS applied_count,
          SUM(CASE WHEN status='applying' THEN 1 ELSE 0 END) AS applying_count
        FROM raw_model_settlements WHERE customer_id=${customerId} GROUP BY reservation_id
      ), usage AS (
        SELECT reservation_id,COUNT(*) AS usage_count,SUM(COALESCE(credits_charged,0)) AS usage_credits
        FROM usage_events WHERE customer_id=${customerId} AND workload_type='api_key'
          AND reservation_id IS NOT NULL GROUP BY reservation_id
      ), ledger AS (
        SELECT reference_id,COUNT(*) AS ledger_count,SUM(delta) AS net_delta,
          SUM(CASE WHEN kind='inference_reserve' THEN 1 ELSE 0 END) AS reserve_count,
          SUM(CASE WHEN kind='inference_release' THEN 1 ELSE 0 END) AS release_count
        FROM credit_ledger WHERE customer_id=${customerId} AND reference_id IS NOT NULL GROUP BY reference_id
      )
      SELECT r.id AS reservation_id,r.status,r.reserved_credits,r.settled_credits,r.created_at,r.settled_at,
        COALESCE(a.attempt_count,0) AS attempt_count,a.attempt_statuses,a.latest_attempt_update,
        COALESCE(a.stale_unresolved_attempts,0) AS stale_unresolved_attempts,
        COALESCE(s.settlement_count,0) AS settlement_count,COALESCE(s.applied_count,0) AS applied_count,
        COALESCE(s.applying_count,0) AS applying_count,s.actual_credits,
        COALESCE(u.usage_count,0) AS usage_count,COALESCE(u.usage_credits,0) AS usage_credits,
        COALESCE(l.ledger_count,0) AS ledger_count,COALESCE(l.net_delta,0) AS ledger_net_delta,
        COALESCE(l.reserve_count,0) AS reserve_ledger_count,COALESCE(l.release_count,0) AS release_ledger_count
      FROM raw_model_reservations r LEFT JOIN attempts a ON a.reservation_id=r.id
      LEFT JOIN settlements s ON s.reservation_id=r.id LEFT JOIN usage u ON u.reservation_id=r.id
      LEFT JOIN ledger l ON l.reference_id=r.id
      WHERE r.customer_id=${customerId} AND (
        (r.status='open' AND r.created_at<${since}) OR
        (r.status='open' AND COALESCE(s.settlement_count,0)>0) OR
        (r.status='settled' AND (COALESCE(s.settlement_count,0)=0 OR COALESCE(s.applied_count,0)=0 OR s.actual_credits!=r.settled_credits)) OR
        (r.status='settled' AND COALESCE(a.attempt_count,0)=0) OR
        (r.status='settled' AND (COALESCE(u.usage_count,0)=0 OR COALESCE(u.usage_credits,0)!=COALESCE(r.settled_credits,0))) OR
        (r.status='released' AND (COALESCE(l.release_count,0)=0 OR COALESCE(s.settlement_count,0)>0)) OR
        (COALESCE(l.reserve_count,0)=0) OR
        (COALESCE(l.net_delta,0)!=(CASE r.status WHEN 'open' THEN -r.reserved_credits WHEN 'settled' THEN -COALESCE(r.settled_credits,0) ELSE 0 END)) OR
        COALESCE(a.stale_unresolved_attempts,0)>0 OR COALESCE(a.attempt_count,0)>1 OR COALESCE(s.applying_count,0)>0
      ) ORDER BY r.created_at,r.id
    `),
    query("attempt_reservation_scope_mismatches", `
      SELECT i.attempt_id,i.reservation_id,i.status,i.started_at,i.updated_at,
        r.customer_id AS reservation_customer_id,r.api_key_id AS reservation_api_key_id,
        substr(i.workload_id,1,6)||'…'||substr(i.workload_id,-4) AS attempt_api_key_id_masked
      FROM workload_inference_attempt_index i
      LEFT JOIN raw_model_reservations r ON r.id=i.reservation_id
      WHERE i.customer_id=${customerId} AND (
        r.id IS NULL OR r.customer_id!=i.customer_id OR r.api_key_id!=i.workload_id OR i.workload_type!='api_key'
      ) ORDER BY i.started_at,i.attempt_id
    `),
    query("settlement_reservation_scope_mismatches", `
      SELECT s.reservation_id,s.status,s.actual_credits,s.customer_id AS settlement_customer_id,
        r.customer_id AS reservation_customer_id,s.api_key_id AS settlement_api_key_id,
        r.api_key_id AS reservation_api_key_id,s.created_at,s.applied_at
      FROM raw_model_settlements s LEFT JOIN raw_model_reservations r ON r.id=s.reservation_id
      WHERE s.customer_id=${customerId} AND (
        r.id IS NULL OR r.customer_id!=s.customer_id OR r.api_key_id!=s.api_key_id
      ) ORDER BY s.created_at,s.reservation_id
    `),
    query("api_usage_reservation_scope_mismatches", `
      SELECT u.id AS usage_event_id,u.reservation_id,u.provider_attempt_id,u.credits_charged,
        u.customer_id AS usage_customer_id,r.customer_id AS reservation_customer_id,
        u.workload_id AS usage_api_key_id,r.api_key_id AS reservation_api_key_id,u.created_at
      FROM usage_events u LEFT JOIN raw_model_reservations r ON r.id=u.reservation_id
      WHERE u.customer_id=${customerId} AND u.workload_type='api_key' AND u.reservation_id IS NOT NULL AND (
        r.id IS NULL OR r.customer_id!=u.customer_id OR r.api_key_id!=u.workload_id
      ) ORDER BY u.created_at,u.id
    `),
    query("api_ledger_reservation_scope_mismatches", `
      SELECT l.id AS ledger_id,l.reference_id AS reservation_id,l.kind,l.delta,l.workload_type,
        l.workload_id AS ledger_api_key_id,r.customer_id AS reservation_customer_id,
        r.api_key_id AS reservation_api_key_id,l.created_at
      FROM credit_ledger l LEFT JOIN raw_model_reservations r ON r.id=l.reference_id
      WHERE l.customer_id=${customerId} AND l.kind IN ('inference_reserve','inference_release','inference_settlement_refund') AND (
        r.id IS NULL OR l.workload_type!='api_key' OR l.workload_id!=r.api_key_id OR r.customer_id!=l.customer_id
      ) ORDER BY l.created_at,l.id
    `),
    query("provider_cost_usage_mismatches", `
      SELECT p.id AS provider_cost_event_id,p.usage_event_id,p.provider_attempt_id,
        p.provider AS cost_provider,u.provider AS usage_provider,
        p.provider_model AS cost_model,u.provider_model AS usage_model,
        p.cost_micros,u.provider_cost_micros,p.created_at
      FROM provider_cost_events p LEFT JOIN usage_events u ON u.id=p.usage_event_id AND u.customer_id=p.customer_id
      WHERE p.customer_id=${customerId} AND (
        u.id IS NULL OR p.provider_attempt_id IS NOT u.provider_attempt_id OR
        p.provider IS NOT u.provider OR p.provider_model IS NOT u.provider_model OR
        p.cost_micros IS NOT u.provider_cost_micros
      ) ORDER BY p.created_at,p.id
    `),
    query("duplicate_raw_request_groups", `
      SELECT COUNT(*) AS duplicate_request_groups,COALESCE(SUM(attempts-1),0) AS extra_attempts,
        MIN(attempts) AS min_attempts_in_group,MAX(attempts) AS max_attempts_in_group
      FROM (
        SELECT request_hash,COUNT(*) AS attempts FROM workload_inference_attempt_index
        WHERE customer_id=${customerId} GROUP BY request_hash HAVING COUNT(*)>1
      )
    `),
    query("usage_provider_attempt_integrity", `
      SELECT COUNT(*) AS api_usage_rows,COUNT(DISTINCT provider_attempt_id) AS distinct_provider_attempts,
        SUM(CASE WHEN provider_attempt_id IS NULL THEN 1 ELSE 0 END) AS rows_missing_provider_attempt_id,
        SUM(CASE WHEN reservation_id IS NULL THEN 1 ELSE 0 END) AS api_usage_rows_missing_reservation_id,
        SUM(CASE WHEN provider_cost_micros IS NULL THEN 1 ELSE 0 END) AS rows_missing_provider_cost
      FROM usage_events WHERE customer_id=${customerId} AND workload_type='api_key'
    `),
    query("current_routes_and_rates", `
      SELECT alias,provider,provider_model,enabled,COUNT(*) AS route_targets,MIN(position) AS first_position,
        MIN(input_credits_per_million) AS min_input_rate,MAX(input_credits_per_million) AS max_input_rate,
        MIN(output_credits_per_million) AS min_output_rate,MAX(output_credits_per_million) AS max_output_rate,
        MAX(provider_input_cost_micros_per_million) AS provider_input_cost_micros_per_million,
        MAX(provider_output_cost_micros_per_million) AS provider_output_cost_micros_per_million,
        MAX(provider_image_cost_micros) AS provider_image_cost_micros,
        MAX(provider_audio_cost_micros_per_minute) AS provider_audio_cost_micros_per_minute
      FROM model_route_targets WHERE customer_id=${customerId} OR customer_id IS NULL
      GROUP BY alias,provider,provider_model,enabled ORDER BY alias,first_position
    `),
    query("model_rate_versions", `
      SELECT alias,version,input_credits_per_million,output_credits_per_million,image_credits,
        audio_credits_per_minute,provider_input_cost_micros_per_million,
        provider_output_cost_micros_per_million,provider_image_cost_micros,
        provider_audio_cost_micros_per_minute,created_at
      FROM model_rates ORDER BY alias,version
    `),
    query("assistant_reply_jobs_by_status_error", `
      SELECT status,COALESCE(last_error,'(none)') AS error_code,COUNT(*) AS jobs,
        MIN(created_at) AS first_created_at,MAX(updated_at) AS last_updated_at,
        SUM(attempts) AS delivery_attempts,SUM(image_count) AS image_count,SUM(audio_seconds) AS audio_seconds
      FROM reply_jobs WHERE customer_id=${customerId} GROUP BY status,error_code ORDER BY jobs DESC LIMIT 200
    `),
  ];
  const included = new Set([
    "customer_account","required_migrations","all_credit_ledger_details","assistant_reservation_details",
    "assistant_attempt_details","all_usage_event_details","raw_api_reservation_details",
    "raw_api_attempt_details","raw_api_settlement_details","all_provider_cost_event_details",
    "resolution_audit_details","current_routes_and_rates","model_rate_versions",
    "assistant_reply_jobs_by_status_error",
  ]);
  return candidates.filter((item) => included.has(item.name));
}

export function assertReadOnlyQueries(queries) {
  if (!Array.isArray(queries) || queries.length < 10) throw new Error("audit_query_set_invalid");
  for (const item of queries) {
    const sql = String(item?.sql || "").trim();
    if (!/^(SELECT|WITH)\b/i.test(sql) || sql.includes(";") ||
      /\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|VACUUM|ATTACH|DETACH|PRAGMA)\b/i.test(sql)) {
      throw new Error("audit_query_not_read_only");
    }
  }
  return true;
}

const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const utcDay = (value) => {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? new Date(timestamp * 1000).toISOString().slice(0, 10) : "(unknown)";
};
function groupRows(rows, dimensions, sums = []) {
  const groups = new Map();
  for (const row of rows || []) {
    const values = dimensions.map((key) => key === "day" ? utcDay(row.created_at ?? row.started_at) : (row[key] ?? "(null)"));
    const serialized = JSON.stringify(values);
    let group = groups.get(serialized);
    if (!group) {
      group = Object.fromEntries(dimensions.map((key, index) => [key, values[index]]));
      group.count = 0;
      for (const name of sums) group[name] = 0;
      groups.set(serialized, group);
    }
    group.count += 1;
    for (const name of sums) group[name] += numeric(row[name]);
  }
  return [...groups.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
const tally = (rows, key, sums = []) => groupRows(rows, [key], sums);
function byKey(rows, key) {
  const result = new Map();
  for (const row of rows || []) {
    if (row[key] == null) continue;
    const bucket = result.get(String(row[key])) || [];
    bucket.push(row);
    result.set(String(row[key]), bucket);
  }
  return result;
}

export function buildAuditSummary(sections, now = Math.floor(Date.now() / 1000)) {
  const ledger = sections.all_credit_ledger_details || [];
  const assistantReservations = sections.assistant_reservation_details || [];
  const assistantAttempts = sections.assistant_attempt_details || [];
  const usage = sections.all_usage_event_details || [];
  const reservations = sections.raw_api_reservation_details || [];
  const attempts = sections.raw_api_attempt_details || [];
  const settlements = sections.raw_api_settlement_details || [];
  const providerCosts = sections.all_provider_cost_event_details || [];
  const resolutionAudit = sections.resolution_audit_details || [];
  const account = sections.customer_account?.[0] || null;
  const ledgerTotal = ledger.reduce((sum, row) => sum + numeric(row.delta), 0);

  const attemptsByReservation = byKey(attempts, "reservation_id");
  const settlementsByReservation = byKey(settlements, "reservation_id");
  const usageByReservation = byKey(usage.filter((row) => row.workload_type === "api_key"), "reservation_id");
  const ledgerByReference = byKey(ledger, "reference_id");
  const usageById = new Map(usage.map((row) => [String(row.usage_event_id), row]));
  const costsByUsageId = byKey(providerCosts, "usage_event_id");
  const attemptToReservation = new Map(attempts.map((row) => [String(row.attempt_id), String(row.reservation_id || "")]));
  const staleCutoff = now - 15 * 60;

  const reservationReconciliation = reservations.map((reservation) => {
    const id = String(reservation.reservation_id);
    const rowAttempts = attemptsByReservation.get(id) || [];
    const rowSettlements = settlementsByReservation.get(id) || [];
    const directUsage = usageByReservation.get(id) || [];
    const fallbackUsage = usage.filter((event) => event.workload_type === "api_key" && event.provider_attempt_id &&
      attemptToReservation.get(String(event.provider_attempt_id)) === id);
    const linkedUsage = [...new Map([...directUsage, ...fallbackUsage].map((event) => [String(event.usage_event_id), event])).values()];
    const rowLedger = ledgerByReference.get(id) || [];
    const rowCosts = linkedUsage.flatMap((event) => costsByUsageId.get(String(event.usage_event_id)) || []);
    const status = String(reservation.status);
    const reserved = numeric(reservation.reserved_credits);
    const settled = reservation.settled_credits == null ? null : numeric(reservation.settled_credits);
    const actualValues = rowSettlements.map((entry) => numeric(entry.actual_credits));
    const applied = rowSettlements.filter((entry) => entry.status === "applied").length;
    const applying = rowSettlements.filter((entry) => entry.status === "applying").length;
    const ledgerNet = rowLedger.reduce((sum, entry) => sum + numeric(entry.delta), 0);
    const expectedLedgerNet = status === "open" ? -reserved : status === "settled" ? -(settled ?? 0) : status === "released" ? 0 : null;
    const usageCredits = directUsage.reduce((sum, entry) => sum + numeric(entry.credits_charged), 0);
    const flags = [];
    if (status === "open" && numeric(reservation.created_at) < staleCutoff) flags.push("stale_open_reservation");
    if (status === "open" && rowSettlements.length) flags.push("open_reservation_has_settlement");
    if (status === "settled" && (!rowSettlements.length || !applied || actualValues.some((value) => value !== settled))) flags.push("settlement_state_or_amount_mismatch");
    if (status === "settled" && !rowAttempts.length) flags.push("settled_reservation_has_no_attempt");
    if (status === "settled" && (!directUsage.length || usageCredits !== (settled ?? 0))) flags.push("settled_reservation_usage_mismatch");
    if (status === "released" && (!rowLedger.some((entry) => entry.kind === "inference_release") || rowSettlements.length)) flags.push("released_reservation_ledger_or_settlement_mismatch");
    if (!rowLedger.some((entry) => entry.kind === "inference_reserve")) flags.push("missing_reserve_ledger_entry");
    if (expectedLedgerNet != null && ledgerNet !== expectedLedgerNet) flags.push("reservation_ledger_delta_mismatch");
    if (rowAttempts.some((entry) => ["started", "unknown_outcome", "result_recorded"].includes(entry.status) && numeric(entry.updated_at) < staleCutoff)) flags.push("stale_unresolved_attempt");
    if (rowAttempts.length > 1) flags.push("multiple_attempts_for_reservation_review");
    if (applying) flags.push("settlement_still_applying");
    return {
      reservation_id: id,
      api_key_id: reservation.api_key_id,
      status,
      reserved_credits: reserved,
      settled_credits: settled,
      created_at: reservation.created_at,
      settled_at: reservation.settled_at,
      attempt_count: rowAttempts.length,
      attempt_statuses: [...new Set(rowAttempts.map((entry) => entry.status))],
      settlement_count: rowSettlements.length,
      applied_settlement_count: applied,
      applying_settlement_count: applying,
      settlement_actual_credits: actualValues,
      linked_usage_rows: linkedUsage.length,
      linked_direct_usage_credit_atoms: usageCredits,
      linked_provider_cost_micros: linkedUsage.reduce((sum, entry) => sum + numeric(entry.provider_cost_micros), 0),
      linked_provider_cost_event_micros: rowCosts.reduce((sum, entry) => sum + numeric(entry.cost_micros), 0),
      ledger_rows: rowLedger.length,
      ledger_net_delta_atoms: ledgerNet,
      expected_ledger_net_delta_atoms: expectedLedgerNet,
      flags,
    };
  });

  const attemptReservationMismatches = attempts.filter((attempt) => {
    const reservation = reservations.find((row) => String(row.reservation_id) === String(attempt.reservation_id));
    return !reservation || String(reservation.api_key_id) !== String(attempt.workload_id || "");
  }).map((row) => ({ attempt_id: row.attempt_id, reservation_id: row.reservation_id, status: row.status }));
  const reservationsById = new Map(reservations.map((row) => [String(row.reservation_id), row]));
  const settlementReservationMismatches = settlements.filter((settlement) => {
    const reservation = reservationsById.get(String(settlement.reservation_id));
    return !reservation || String(reservation.api_key_id) !== String(settlement.api_key_id || "") ||
      String(settlement.customer_id || "") !== String(account?.customer_id || "");
  })
    .map(({ reservation_id, status }) => ({ reservation_id, status }));
  const usageReservationMismatches = usage.filter((event) => event.workload_type === "api_key" && event.reservation_id &&
    (!reservationsById.has(String(event.reservation_id)) ||
      String(reservationsById.get(String(event.reservation_id)).api_key_id) !== String(event.workload_id || "")))
    .map(({ usage_event_id, reservation_id, provider_attempt_id }) => ({ usage_event_id, reservation_id, provider_attempt_id }));
  const ledgerReservationMismatches = ledger.filter((entry) => ["inference_reserve", "inference_release", "inference_settlement_refund"].includes(entry.kind) &&
    entry.reference_id && (!reservationsById.has(String(entry.reference_id)) || entry.workload_type !== "api_key" ||
      String(reservationsById.get(String(entry.reference_id)).api_key_id) !== String(entry.workload_id || "")))
    .map(({ ledger_id, reference_id, kind, delta, created_at }) => ({ ledger_id, reference_id, kind, delta, created_at }));
  const providerCostMismatches = providerCosts.filter((cost) => {
    const event = usageById.get(String(cost.usage_event_id));
    return !event || String(cost.provider_attempt_id || "") !== String(event.provider_attempt_id || "") ||
      String(cost.provider || "") !== String(event.provider || "") || String(cost.provider_model || "") !== String(event.provider_model || "") ||
      numeric(cost.cost_micros) !== numeric(event.provider_cost_micros);
  }).map(({ provider_cost_event_id, usage_event_id, provider_attempt_id, provider, provider_model, cost_micros }) =>
    ({ provider_cost_event_id, usage_event_id, provider_attempt_id, provider, provider_model, cost_micros }));

  const requestGroups = new Map();
  for (const attempt of attempts) {
    const hash = String(attempt.request_hash || "");
    if (!hash) continue;
    const group = requestGroups.get(hash) || [];
    group.push(attempt);
    requestGroups.set(hash, group);
  }
  const duplicateRequestGroups = [...requestGroups.values()].filter((group) => group.length > 1).map((group) => ({
    attempts: group.length,
    attempt_ids: group.map((row) => row.attempt_id),
    reservation_ids: group.map((row) => row.reservation_id),
    first_started_at: Math.min(...group.map((row) => numeric(row.started_at))),
    last_started_at: Math.max(...group.map((row) => numeric(row.started_at))),
  }));
  const attemptsWithoutHashes = attempts.map(({ request_hash, workload_id, ...row }) => row);
  const providerAttemptGroups = new Map();
  for (const event of usage) {
    const id = String(event.provider_attempt_id || "");
    if (!id) continue;
    const group = providerAttemptGroups.get(id) || [];
    group.push(event);
    providerAttemptGroups.set(id, group);
  }
  const duplicateProviderAttempts = [...providerAttemptGroups.values()].filter((group) => group.length > 1).map((group) => ({
    count: group.length, usage_event_ids: group.map((row) => row.usage_event_id),
  }));

  return {
    sourceRowCounts: {
      credit_ledger: ledger.length, assistant_reservations: assistantReservations.length,
      assistant_attempts: assistantAttempts.length, usage_events: usage.length,
      raw_api_reservations: reservations.length, raw_api_attempts: attempts.length,
      raw_api_settlements: settlements.length, provider_cost_events: providerCosts.length,
      resolution_audit: resolutionAudit.length,
    },
    creditLedgerByDayKind: groupRows(ledger, ["day", "kind", "workload_type"], ["delta"]),
    accountVsAllLedger: account ? {
      balance: numeric(account.balance), lifetime_granted: numeric(account.lifetime_granted),
      lifetime_consumed: numeric(account.lifetime_consumed), all_time_ledger_delta_atoms: ledgerTotal,
      balance_minus_ledger_delta_atoms: numeric(account.balance) - ledgerTotal,
    } : null,
    assistantReservationsByStatus: tally(assistantReservations, "status", ["reserved_credits", "settled_credits"]),
    assistantAttemptsByDayRouteStatus: groupRows(assistantAttempts, ["day", "provider", "model", "model_alias", "status"],
      ["input_units", "output_units", "reasoning_units", "image_units", "audio_seconds", "provider_cost_micros"]),
    allUsageByDayWorkloadRoute: groupRows(usage, ["day", "workload_type", "provider", "provider_model", "model_alias"],
      ["input_units", "output_units", "reasoning_units", "credits_charged", "provider_cost_micros"]),
    rawApiReservationsByStatus: tally(reservations, "status", ["reserved_credits", "settled_credits"]),
    rawApiReservationsByDayStatus: groupRows(reservations, ["day", "status"], ["reserved_credits", "settled_credits"]),
    rawApiAttemptsByDayRouteStatus: groupRows(attempts, ["day", "provider", "model", "model_alias", "status"],
      ["input_units", "output_units", "reasoning_units", "provider_cost_micros"]),
    rawApiSettlementsByStatus: tally(settlements, "status", ["actual_credits"]),
    providerCostsByDayRoute: groupRows(providerCosts, ["day", "provider", "provider_model"], ["cost_micros"]),
    resolutionAuditByOutcome: tally(resolutionAudit, "outcome"),
    reservationReconciliation: reservationReconciliation,
    reservationIntegrityAnomalies: reservationReconciliation.filter((row) => row.flags.length > 0),
    attemptReservationMismatches,
    settlementReservationMismatches,
    usageReservationMismatches,
    ledgerReservationMismatches,
    providerCostMismatches,
    duplicateRequestGroups,
    duplicateProviderAttempts,
    usageProviderAttemptIntegrity: {
      api_usage_rows: usage.filter((row) => row.workload_type === "api_key").length,
      api_rows_without_provider_attempt_id: usage.filter((row) => row.workload_type === "api_key" && !row.provider_attempt_id).length,
      api_rows_without_reservation_reference: usage.filter((row) => row.workload_type === "api_key" && !row.reservation_id).length,
    },
  };
}

export function validateD1BatchResponse(payload, queries) {
  if (!payload || payload.success !== true || !Array.isArray(payload.result) || payload.result.length !== queries.length) {
    throw new Error("d1_batch_response_invalid");
  }
  let rowsRead = 0;
  for (const item of payload.result) {
    if (item?.success === false || !item?.meta || Number(item.meta.rows_written) !== 0 || item.meta.changed_db === true) {
      throw new Error("d1_read_only_invariant_failed");
    }
    rowsRead += Number(item.meta.rows_read || 0);
  }
  return { rowsRead, rowsWritten: 0 };
}

export function encryptReport(report, publicKeyPem) {
  const dataKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dataKey, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(report)), cipher.final()]);
  const encryptedKey = publicEncrypt({ key: publicKeyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, dataKey);
  return JSON.stringify({
    format: "mkety-assist-encrypted-audit-v1",
    keyWrap: "RSA-OAEP-SHA256",
    contentCipher: "AES-256-GCM",
    encryptedKey: encryptedKey.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  });
}

export async function runAudit(env = process.env) {
  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID || "");
  const databaseId = String(env.AUDIT_DATABASE_ID || "");
  const token = String(env.CLOUDFLARE_API_TOKEN || "");
  if (!/^[a-f0-9]{32}$/i.test(accountId) || !/^[a-f0-9-]{36}$/i.test(databaseId) || token.length < 20) {
    throw new Error("audit_credentials_or_scope_invalid");
  }
  const queries = buildFullCreditAuditQueries();
  assertReadOnlyQueries(queries);
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ batch: queries.map(({ sql, params }) => ({ sql, params })) }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`d1_query_http_${response.status}`);
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > 50 * 1024 * 1024) throw new Error("d1_audit_response_exceeds_safe_limit");
  const bodyText = await response.text();
  if (Buffer.byteLength(bodyText) > 50 * 1024 * 1024) throw new Error("d1_audit_response_exceeds_safe_limit");
  let payload;
  try { payload = JSON.parse(bodyText); } catch { throw new Error("d1_query_response_invalid_json"); }
  const metrics = validateD1BatchResponse(payload, queries);
  const sections = Object.fromEntries(queries.map((item, index) => [item.name, payload.result[index].results || []]));
  if (sections.customer_account?.length !== 1 || sections.customer_account[0]?.slug?.toLowerCase() !== CUSTOMER_SLUG) {
    throw new Error("audit_customer_not_resolved_uniquely");
  }
  const report = {
    reportType: "mkety-assist-starpips-full-history-credit-audit",
    customerSlug: CUSTOMER_SLUG,
    scope: "all_history",
    generatedAt: new Date().toISOString(),
    readOnly: true,
    privacy: "No message or prompt tables, transcripts, media, credentials, API key secrets, idempotency keys, resolution tokens, or request hashes are emitted. Operator-entered resolution evidence is included only in this encrypted report.",
    metrics,
    summary: buildAuditSummary(sections),
    sections: {
      ...sections,
      all_credit_ledger_details: (sections.all_credit_ledger_details || []).map(({ workload_id, ...row }) => row),
      all_usage_event_details: (sections.all_usage_event_details || []).map(({ workload_id, ...row }) => row),
      raw_api_attempt_details: (sections.raw_api_attempt_details || []).map(({ request_hash, workload_id, ...row }) => row),
    },
  };
  const publicKey = readFileSync(PUBLIC_KEY_PATH, "utf8");
  const encrypted = encryptReport(report, publicKey);
  writeFileSync("starpips-assist-full-credit-audit.enc.json", `${encrypted}\n`, { mode: 0o600 });
  if (env.GITHUB_STEP_SUMMARY) {
    writeFileSync(env.GITHUB_STEP_SUMMARY,
      "## Starpips Assist all-history D1 audit\n\nRead-only query batch completed. Zero rows written. Detailed report is encrypted and attached for the designated audit reviewer.\n");
  }
  return { queryCount: queries.length, rowsRead: metrics.rowsRead, artifactPath: "starpips-assist-full-credit-audit.enc.json" };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runAudit().then(() => {
    process.stdout.write("Read-only all-history D1 audit complete; encrypted report created.\n");
  }).catch((error) => {
    const code = /^[a-z0-9_]+$/i.test(String(error?.message || "")) ? error.message : "audit_failed";
    process.stderr.write(`Read-only D1 audit stopped safely (${code}); no plaintext report was written.\n`);
    process.exitCode = 1;
  });
}
