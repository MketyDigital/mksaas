interface OperatorOidcEnv {
  DB: D1Database;
  MKETY_ASSIST_OPS_AUTH_ISSUER: string;
  MKETY_ASSIST_OPS_AUTH_CLIENT_ID: string;
  MKETY_ASSIST_OPS_ALLOWED_EMAIL: string;
}

type Discovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
};

type Claims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
};

type OperatorAuthTransaction = {
  id: string;
  code_verifier: string;
  nonce: string;
};

type OidcTokenResponse = {
  id_token?: string;
  access_token?: string;
};

type OidcUserInfo = {
  email?: string;
  email_verified?: boolean;
};

type JwksResponse = {
  keys?: Array<JsonWebKey & { kid?: string }>;
};

type IdTokenHeader = {
  alg?: string;
  kid?: string;
};

const encoder = new TextEncoder();

export async function startOperatorOidc(request: Request, env: OperatorOidcEnv): Promise<Response> {
  assertConfigured(env);
  const discovery = await discover(env.MKETY_ASSIST_OPS_AUTH_ISSUER);
  const state = randomToken(32);
  const verifier = randomToken(48);
  const nonce = randomToken(32);
  const challenge = base64UrlBytes(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))));
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    "INSERT INTO operator_auth_transactions (id,state_hash,code_verifier,nonce,expires_at,created_at) VALUES (?,?,?,?,?,?)",
  ).bind(
    "opauth_" + crypto.randomUUID().replace(/-/g, ""),
    await sha256(state),
    verifier,
    nonce,
    now + 600,
    now,
  ).run();

  const callback = new URL("/api/ops/auth/callback", request.url).toString();
  const url = new URL(discovery.authorization_endpoint);
  url.searchParams.set("client_id", env.MKETY_ASSIST_OPS_AUTH_CLIENT_ID);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return Response.redirect(url.toString(), 302);
}

export async function finishOperatorOidc(request: Request, env: OperatorOidcEnv): Promise<string> {
  assertConfigured(env);
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  if (!state || !code) throw new Error("missing_oidc_callback_parameters");

  const now = Math.floor(Date.now() / 1000);
  const tx = await env.DB.prepare(
    "SELECT id,code_verifier,nonce FROM operator_auth_transactions WHERE state_hash=? AND expires_at>? LIMIT 1",
  ).bind(await sha256(state), now).first<OperatorAuthTransaction>();
  if (!tx) throw new Error("invalid_or_expired_oidc_state");
  await env.DB.prepare("DELETE FROM operator_auth_transactions WHERE id=?").bind(tx.id).run();

  const discovery = await discover(env.MKETY_ASSIST_OPS_AUTH_ISSUER);
  const callback = new URL("/api/ops/auth/callback", request.url).toString();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: callback,
    client_id: env.MKETY_ASSIST_OPS_AUTH_CLIENT_ID,
    code_verifier: tx.code_verifier,
  });
  const tokenResponse = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
  if (!tokenResponse.ok) throw new Error("oidc_token_exchange_failed");
  const tokens = await tokenResponse.json<OidcTokenResponse>();
  if (!tokens.id_token) throw new Error("oidc_id_token_missing");

  const claims = await verifyIdToken(
    tokens.id_token,
    discovery.jwks_uri,
    normalizeIssuer(env.MKETY_ASSIST_OPS_AUTH_ISSUER),
    env.MKETY_ASSIST_OPS_AUTH_CLIENT_ID,
    tx.nonce,
  );

  let email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  let verified = claims.email_verified === true;
  if ((!email || !verified) && tokens.access_token && discovery.userinfo_endpoint) {
    const userInfoResponse = await fetch(discovery.userinfo_endpoint, {
      headers: { authorization: `Bearer ${tokens.access_token}`, accept: "application/json" },
    });
    if (userInfoResponse.ok) {
      const user = await userInfoResponse.json<OidcUserInfo>();
      if (!email && typeof user.email === "string") email = user.email.trim().toLowerCase();
      verified = verified || user.email_verified === true;
    }
  }

  const allowed = env.MKETY_ASSIST_OPS_ALLOWED_EMAIL.trim().toLowerCase();
  if (!email || email !== allowed) throw new Error("operator_email_not_allowed");
  if (!verified) throw new Error("operator_email_not_verified");
  return email;
}

async function verifyIdToken(token: string, jwksUri: string, issuer: string, clientId: string, nonce: string): Promise<Claims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid_id_token");
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0]))) as IdTokenHeader;
  const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1]))) as Claims;
  if (header.alg !== "RS256" || !header.kid) throw new Error("unsupported_id_token_algorithm");

  const jwksResponse = await fetch(jwksUri, { headers: { accept: "application/json" } });
  if (!jwksResponse.ok) throw new Error("oidc_jwks_failed");
  const jwks = await jwksResponse.json<JwksResponse>();
  const jwk = jwks.keys?.find((key) => key.kid === header.kid) ?? null;
  if (!jwk) throw new Error("oidc_signing_key_not_found");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64Url(parts[2]),
    encoder.encode(parts[0] + "." + parts[1]),
  );
  if (!valid) throw new Error("invalid_id_token_signature");

  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const now = Math.floor(Date.now() / 1000);
  if (normalizeIssuer(claims.iss || "") !== issuer) throw new Error("invalid_id_token_issuer");
  if (!aud.includes(clientId)) throw new Error("invalid_id_token_audience");
  if (!claims.exp || claims.exp <= now) throw new Error("expired_id_token");
  if (claims.nonce !== nonce) throw new Error("invalid_id_token_nonce");
  return claims;
}

async function discover(issuer: string): Promise<Discovery> {
  const response = await fetch(normalizeIssuer(issuer) + "/.well-known/openid-configuration", {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("oidc_discovery_failed");
  const d = await response.json<Discovery>();
  if (!d.authorization_endpoint || !d.token_endpoint || !d.jwks_uri) throw new Error("oidc_discovery_incomplete");
  return d;
}

function assertConfigured(env: OperatorOidcEnv) {
  if (!env.MKETY_ASSIST_OPS_AUTH_ISSUER || !env.MKETY_ASSIST_OPS_AUTH_CLIENT_ID || !env.MKETY_ASSIST_OPS_ALLOWED_EMAIL) {
    throw new Error("operator_oidc_not_configured");
  }
}

function normalizeIssuer(value: string) {
  return value.replace(/\/+$/, "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes: number) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return base64UrlBytes(data);
}

function base64UrlBytes(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const raw = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = raw + "===".slice((raw.length + 3) % 4);
  return Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0));
}
