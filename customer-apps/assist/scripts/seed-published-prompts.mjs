const API = "https://api.cloudflare.com/client/v4";
const PROMPT_SOURCE_VERSION = "published-prompt-snapshot-v1";
const TTL_SECONDS = 86400;

export function promptCacheKey(customerId, assistantId) {
  const part = (value) => encodeURIComponent(String(value || "").trim());
  return ["mkety-assist", "context", "v1", part(customerId), part(assistantId), "published_prompt_snapshot", "_", PROMPT_SOURCE_VERSION].join(":");
}

export async function seedPublishedPrompts({ accountId, databaseId, namespaceId, token, fetchImpl = fetch }) {
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const response = await fetchImpl(`${API}/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sql: `SELECT p.customer_id,p.assistant_id,p.version,p.instructions
            FROM assistant_prompt_versions p
            JOIN assistants a ON a.id=p.assistant_id AND a.customer_id=p.customer_id
            WHERE p.status='published' AND a.status='active' AND a.deleted_at IS NULL`,
      params: [],
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error("Could not read published Assist prompts for cache seeding.");
  const rows = payload.result?.[0]?.results || [];
  if (!rows.length) throw new Error("No active published Assist prompts were found to seed.");

  const writeOne = async (row) => {
    const key = promptCacheKey(row.customer_id, row.assistant_id);
    const body = JSON.stringify({
      sourceVersion: PROMPT_SOURCE_VERSION,
      value: JSON.stringify({ version: Number(row.version), instructions: String(row.instructions || "") }),
    });
    const write = await fetchImpl(
      `${API}/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}?expiration_ttl=${TTL_SECONDS}`,
      { method: "PUT", headers, body },
    );
    if (!write.ok) throw new Error("Could not seed a published Assist prompt snapshot.");
  };

  for (let start = 0; start < rows.length; start += 8) {
    await Promise.all(rows.slice(start, start + 8).map(writeOne));
  }
  return { seeded: rows.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const required = ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "ASSIST_D1_ID", "ASSIST_PROMPT_KV_ID"];
  for (const name of required) if (!process.env[name]) throw new Error(`${name} is required.`);
  const result = await seedPublishedPrompts({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    databaseId: process.env.ASSIST_D1_ID,
    namespaceId: process.env.ASSIST_PROMPT_KV_ID,
    token: process.env.CLOUDFLARE_API_TOKEN,
  });
  console.log(`Seeded ${result.seeded} active published Assist prompt snapshots.`);
}
