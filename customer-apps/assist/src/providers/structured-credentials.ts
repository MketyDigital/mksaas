const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToBytes(pem: string) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
  if (!body) throw new Error("vertex_private_key_missing");
  const binary = atob(body);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function parseCredentialJson(secret: string, provider: "vertex" | "bedrock") {
  let parsed: Record<string, any>;
  try { parsed = JSON.parse(secret); } catch { throw new Error(`${provider}_credential_json_invalid`); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${provider}_credential_json_invalid`);
  return parsed;
}

const vertexTokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function vertexAccessTokenFromServiceAccount(secret: string) {
  const service = parseCredentialJson(secret, "vertex");
  const clientEmail = String(service.client_email || "").trim();
  const privateKey = String(service.private_key || "");
  const projectId = String(service.project_id || "").trim();
  const tokenUri = String(service.token_uri || "https://oauth2.googleapis.com/token").trim();
  if (!clientEmail || !privateKey || !projectId) throw new Error("vertex_service_account_incomplete");
  const cacheKey = clientEmail + "|" + projectId;
  const cached = vertexTokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return { accessToken: cached.token, projectId };

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64Url(encoder.encode(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  })));
  const unsigned = `${header}.${payload}`;
  const keyBytes = pemToBytes(privateKey);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned)));
  const assertion = unsigned + "." + base64Url(signature);
  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  const result = await response.json<any>();
  if (!response.ok || !result?.access_token) throw new Error(`vertex_token_http_${response.status}`);
  const expiresIn = Math.max(60, Number(result.expires_in || 3600));
  vertexTokenCache.set(cacheKey, { token: String(result.access_token), expiresAt: Date.now() + expiresIn * 1000 });
  return { accessToken: String(result.access_token), projectId };
}

function utf8(value: string | Uint8Array) {
  return typeof value === "string" ? encoder.encode(value) : value;
}
async function digestSha256(value: string | Uint8Array) {
  const data = utf8(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer));
}
function hex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
async function hmacSha256(key: string | Uint8Array, value: string) {
  const data = utf8(key);
  const imported = await crypto.subtle.importKey("raw", data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, encoder.encode(value)));
}

export async function bedrockHeadersFromCredentialJson(input: {
  secret: string;
  region?: string;
  host: string;
  path: string;
  body: string;
}) {
  const creds = parseCredentialJson(input.secret, "bedrock");
  const accessKeyId = String(creds.accessKeyId || creds.aws_access_key_id || "").trim();
  const secretAccessKey = String(creds.secretAccessKey || creds.aws_secret_access_key || "").trim();
  const sessionToken = String(creds.sessionToken || creds.aws_session_token || "").trim();
  const region = String(input.region || creds.region || creds.aws_region || "us-east-1").trim();
  if (!accessKeyId || !secretAccessKey) throw new Error("bedrock_credentials_incomplete");

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hex(await digestSha256(input.body));
  const pairs: Array<[string,string]> = [
    ["content-type","application/json"],["host",input.host],["x-amz-content-sha256",payloadHash],["x-amz-date",amzDate],
  ];
  if (sessionToken) pairs.push(["x-amz-security-token",sessionToken]);
  pairs.sort(([a],[b]) => a.localeCompare(b));
  const canonicalHeaders = pairs.map(([k,v]) => `${k}:${v.trim()}\n`).join("");
  const signedHeaders = pairs.map(([k]) => k).join(";");
  const canonicalRequest = ["POST",input.path,"",canonicalHeaders,signedHeaders,payloadHash].join("\n");
  const scope = `${dateStamp}/${region}/bedrock/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hex(await digestSha256(canonicalRequest))}`;
  const dateKey = await hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = await hmacSha256(dateKey, region);
  const serviceKey = await hmacSha256(regionKey, "bedrock");
  const signingKey = await hmacSha256(serviceKey, "aws4_request");
  const signature = hex(await hmacSha256(signingKey, stringToSign));
  return {
    region,
    headers: {
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "content-type": "application/json",
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      ...(sessionToken ? { "x-amz-security-token": sessionToken } : {}),
    },
  };
}
