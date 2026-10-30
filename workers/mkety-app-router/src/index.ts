type WorkerStub = { fetch(request: Request): Promise<Response> };
type Dispatcher = { get(name: string): WorkerStub };

type Env = {
  DISPATCHER: Dispatcher;
  MKETY_DEPLOYMENT_LOOKUP_URL: string;
  MKETY_DEPLOYMENT_LOOKUP_SECRET: string;
};

type LookupResult = {
  ok?: unknown;
  deployment?: {
    providerDeploymentRef?: unknown;
    deploymentId?: unknown;
    tenantId?: unknown;
    kind?: unknown;
  };
};

const SCRIPT_NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const APEX_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mkety Apps</title><meta name="description" content="Applications built and deployed with Mkety."><style>body{margin:0;background:#0b1020;color:#eef2ff;font:16px system-ui,sans-serif;min-height:100vh;display:grid;place-items:center}.card{max-width:680px;padding:48px;border:1px solid #29324b;border-radius:24px;background:#111a2f}h1{font-size:clamp(2.5rem,8vw,5rem);line-height:1;margin:0 0 20px}p{color:#b7c1d9;line-height:1.7}a{display:inline-block;margin-top:16px;padding:12px 18px;border-radius:10px;background:#7167ff;color:#fff;text-decoration:none;font-weight:700}</style></head><body><main class="card"><p>M K E T Y&nbsp; A P P S</p><h1>Your app.<br>Your Mkety link.</h1><p>Mkety gives every application its own secure preview and hosting address. Build, review, and publish customer apps from your Mkety workspace.</p><a href="https://app.mkety.com">Open Mkety Platform</a></main></body></html>`;

function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function lookupDeployment(request: Request, env: Env) {
  let endpoint: URL;
  try {
    endpoint = new URL(env.MKETY_DEPLOYMENT_LOOKUP_URL);
  } catch {
    return null;
  }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) return null;
  const hostname = new URL(request.url).hostname.toLowerCase().replace(/\.$/, '');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.MKETY_DEPLOYMENT_LOOKUP_SECRET}`,
      'x-mkety-customer-host': hostname,
    },
  });
  if (!response.ok) return null;
  return await response.json() as LookupResult;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    if (hostname === 'mkety.app' && (url.protocol === 'https:' || url.protocol === 'http:')) {
      return new Response(APEX_HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
    }

    if (!hostname.endsWith('.mkety.app')) return jsonError(404, 'Application not found.');
    let lookup: LookupResult | null;
    try {
      lookup = await lookupDeployment(request, env);
    } catch {
      return jsonError(502, 'Application hosting is temporarily unavailable.');
    }
    const deployment = lookup?.ok === true ? lookup.deployment : null;
    const scriptName = typeof deployment?.providerDeploymentRef === 'string' ? deployment.providerDeploymentRef : '';
    if (!deployment || !SCRIPT_NAME.test(scriptName)) return jsonError(404, 'Application not found.');

    try {
      return await env.DISPATCHER.get(scriptName).fetch(request);
    } catch {
      return jsonError(502, 'Application is temporarily unavailable.');
    }
  },
};
