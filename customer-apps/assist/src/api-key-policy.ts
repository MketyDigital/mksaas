export type ApiKeyMode = "assistant" | "raw_model";

const MODEL_ALIAS = /^mkety-[a-z0-9][a-z0-9-]{1,80}$/;

export function normalizeApiKeyMode(value: unknown): ApiKeyMode {
  if (value == null || value === "assistant") return "assistant";
  if (value === "raw_model") return "raw_model";
  throw new Error("api_key_mode_invalid");
}

export function normalizeModelAllowlist(value: unknown): string[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { throw new Error("model_allowlist_invalid"); }
  }
  if (!Array.isArray(parsed) || parsed.length > 20) throw new Error("model_allowlist_invalid");
  const aliases = parsed.map((alias) => typeof alias === "string" ? alias.trim() : "");
  if (aliases.some((alias) => !MODEL_ALIAS.test(alias)) || new Set(aliases).size !== aliases.length) {
    throw new Error("model_allowlist_invalid");
  }
  return aliases;
}

export function canUseRawModelApi(input: { enabled: boolean; allowlist: string[]; alias: string }) {
  return input.enabled === true && MODEL_ALIAS.test(input.alias) && input.allowlist.includes(input.alias);
}
