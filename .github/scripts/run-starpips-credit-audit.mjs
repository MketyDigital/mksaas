import { execFileSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { buildCreditAuditQueries, renderCreditAudit, validateAuditInput } from "./assist-credit-audit.mjs";

const customerId = process.env.AUDIT_CUSTOMER_ID || "starpips";
const days = Number(process.env.AUDIT_DAYS || 30);
const validated = validateAuditInput(customerId, days);
const config = "wrangler.audit.jsonc";

function parseWranglerJson(raw) {
  for (const start of raw.matchAll(/[\[{]/g)) {
    try {
      const value = JSON.parse(raw.slice(start.index));
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object") return [value];
    } catch {}
  }
  throw new Error("Wrangler returned an invalid JSON result");
}

const results = [];
for (const [index, query] of buildCreditAuditQueries(validated.customerId, validated.days).entries()) {
  const output = execFileSync("npx", ["--yes", "wrangler@4.129.0", "d1", "execute", "DB", "--remote", "--json", "--config", config, "--command", query.sql], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: process.env,
  });
  const parsed = parseWranglerJson(output);
  const result = parsed[0]?.results || parsed[0]?.result || [];
  results.push({ name: `query_${String(index + 1).padStart(2, "0")}`, rows: result });
}

const report = renderCreditAudit({ ...validated, results });
const json = `${JSON.stringify(report, null, 2)}\n`;
writeFileSync("starpips-credit-audit.json", json, { mode: 0o600 });
if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = results.map((section) => `| ${section.name} | ${section.rows.length} |`).join("\n");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## Starpips Assist D1 credit audit\n\nRead-only aggregate report for ${validated.days} days. No message or prompt content included.\n\n| Section | Rows |\n|---|---:|\n${rows}\n\nFull sanitized report is attached as an artifact.\n`);
}
console.log(`Read-only audit complete: ${results.length} aggregate sections; report written to starpips-credit-audit.json.`);
