import { writeFileSync } from 'node:fs';

const API = 'https://api.cloudflare.com/client/v4';

export const PAYMENT_AUDIT_QUERIES = [
  {
    name: 'checkout_summary',
    sql: `SELECT provider,purchase_type,status,COUNT(*) AS checkout_count,
      COALESCE(SUM(credits),0) AS credits_atoms,
      COALESCE(SUM(canonical_amount_minor),0) AS canonical_amount_minor,
      MIN(created_at) AS oldest_created_at,MAX(created_at) AS newest_created_at
      FROM payment_checkouts GROUP BY provider,purchase_type,status ORDER BY provider,purchase_type,status`,
  },
  {
    name: 'pending_age_summary',
    sql: `SELECT provider,
      SUM(CASE WHEN created_at>=unixepoch()-900 THEN 1 ELSE 0 END) AS pending_under_15m,
      SUM(CASE WHEN created_at<unixepoch()-900 AND created_at>=unixepoch()-3600 THEN 1 ELSE 0 END) AS pending_15m_to_1h,
      SUM(CASE WHEN created_at<unixepoch()-3600 AND created_at>=unixepoch()-86400 THEN 1 ELSE 0 END) AS pending_1h_to_24h,
      SUM(CASE WHEN created_at<unixepoch()-86400 THEN 1 ELSE 0 END) AS pending_over_24h,
      MIN(created_at) AS oldest_pending_created_at
      FROM payment_checkouts WHERE status='pending' GROUP BY provider ORDER BY provider`,
  },
  {
    name: 'checkout_ledger_integrity',
    sql: `SELECT
      (SELECT COUNT(*) FROM payment_checkouts p WHERE p.status='paid' AND NOT EXISTS (
        SELECT 1 FROM credit_ledger l WHERE l.customer_id=p.customer_id AND l.reference_id=p.id
          AND l.kind IN ('topup','plan_funding'))) AS paid_without_funding_ledger,
      (SELECT COUNT(*) FROM payment_checkouts p WHERE p.status='paid' AND COALESCE((
        SELECT SUM(l.delta) FROM credit_ledger l WHERE l.customer_id=p.customer_id AND l.reference_id=p.id
          AND l.kind IN ('topup','plan_funding')),0)<>p.credits) AS paid_ledger_credit_mismatches,
      (SELECT COUNT(*) FROM payment_checkouts p WHERE p.status<>'paid' AND EXISTS (
        SELECT 1 FROM credit_ledger l WHERE l.customer_id=p.customer_id AND l.reference_id=p.id
          AND l.kind IN ('topup','plan_funding')) ) AS unpaid_with_funding_ledger,
      (SELECT COUNT(*) FROM payment_checkouts p WHERE p.status='paid' AND NOT EXISTS (
        SELECT 1 FROM credit_accounts a WHERE a.customer_id=p.customer_id)) AS paid_without_credit_account,
      (SELECT COUNT(*) FROM (SELECT l.reference_id FROM credit_ledger l
        JOIN payment_checkouts p ON p.id=l.reference_id AND p.customer_id=l.customer_id
        WHERE l.kind IN ('topup','plan_funding') GROUP BY l.reference_id HAVING COUNT(*)>1)) AS duplicate_checkout_ledger_entries`,
  },
];

export function assertReadOnlyPaymentQueries(queries = PAYMENT_AUDIT_QUERIES) {
  if (!Array.isArray(queries) || queries.length !== 3) throw new Error('payment_audit_query_set_invalid');
  for (const query of queries) {
    const sql = String(query.sql || '').trim();
    if (!/^SELECT\b/i.test(sql) || /;\s*\S/.test(sql) || /\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|PRAGMA|VACUUM)\b/i.test(sql)) {
      throw new Error(`payment_audit_query_not_read_only_${query.name || 'unknown'}`);
    }
  }
  return true;
}

function validateBatch(payload, queries) {
  if (payload?.success !== true || !Array.isArray(payload.result) || payload.result.length !== queries.length) {
    throw new Error('payment_audit_d1_response_invalid');
  }
  const rowsRead = payload.result.reduce((total, item, index) => {
    if (item?.success === false || Number(item?.meta?.rows_written || 0) !== 0 || item?.meta?.changed_db === true) {
      throw new Error(`payment_audit_read_only_invariant_failed_${queries[index].name}`);
    }
    return total + Number(item?.meta?.rows_read || 0);
  }, 0);
  return rowsRead;
}

async function readJson(url, token, init) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(init?.headers || {}) },
    signal: AbortSignal.timeout(30000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success !== true) throw new Error(`cloudflare_http_${response.status}`);
  return payload;
}

export async function runPaymentAudit(env = process.env) {
  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID || '');
  const tokens = [env.CLOUDFLARE_API_TOKEN, env.MKETY_ASSIST_CF_SAAS_TOKEN].map(String).filter((value) => value.length >= 20);
  if (!/^[a-f0-9]{32}$/i.test(accountId) || !tokens.length) throw new Error('payment_audit_credentials_invalid');
  assertReadOnlyPaymentQueries();

  let database = null;
  let selectedToken = '';
  for (const token of [...new Set(tokens)]) {
    try {
      const response = await readJson(`${API}/accounts/${accountId}/d1/database?name=mkety-assist-prod&per_page=100`, token);
      const matches = (response.result || []).filter((item) => item.name === 'mkety-assist-prod');
      if (matches.length === 1 && /^[a-f0-9-]{36}$/i.test(matches[0].uuid)) {
        database = matches[0];
        selectedToken = token;
        break;
      }
    } catch {}
  }
  if (!database) throw new Error('assist_production_d1_not_resolved');

  const response = await readJson(`${API}/accounts/${accountId}/d1/database/${database.uuid}/query`, selectedToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batch: PAYMENT_AUDIT_QUERIES.map(({ sql }) => ({ sql, params: [] })) }),
  });
  const rowsRead = validateBatch(response, PAYMENT_AUDIT_QUERIES);
  const report = {
    reportType: 'mkety-assist-payment-checkout-audit',
    generatedAt: new Date().toISOString(),
    readOnly: true,
    scope: 'all Assist customers; payment checkout and funding ledger aggregates only',
    customerIdentifiersIncluded: false,
    rowsWritten: 0,
    rowsRead,
    sections: Object.fromEntries(PAYMENT_AUDIT_QUERIES.map((query, index) => [query.name, response.result[index].results || []])),
  };
  const reportPath = String(env.REPORT_PATH || 'assist-payment-checkout-audit.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  if (env.GITHUB_STEP_SUMMARY) {
    writeFileSync(env.GITHUB_STEP_SUMMARY,
      `## Mkety Assist payment checkout audit\n\nRead-only D1 query completed. Rows written: 0. The attached report contains aggregate checkout status and checkout-to-credit-ledger reconciliation counts without customer identifiers or payment references.\n`);
  }
  return { rowsRead, rowsWritten: 0, reportPath };
}

if (process.argv[1]?.endsWith('assist-payment-audit.mjs')) {
  runPaymentAudit().then((result) => process.stdout.write(`Read-only Assist payment audit complete; rows written: ${result.rowsWritten}.\n`))
    .catch((error) => {
      const code = /^[a-z0-9_]+$/i.test(String(error?.message || '')) ? error.message : 'payment_audit_failed';
      process.stderr.write(`Payment audit stopped safely (${code}); no production writes were issued.\n`);
      process.exitCode = 1;
    });
}
