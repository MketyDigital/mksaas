const body = `# Mkety

> Mkety is a technology platform for AI, automation, deployment, media, business solutions, practical learning, and Enterprise delivery.

## Canonical public surfaces
- https://mkety.com/ — public company and product website
- https://mkety.com/platform — Mkety Platform overview
- https://mkety.com/workspaces — AI, Automation, Deploy, and Custom/Enterprise Trading workspaces
- https://mkety.com/trust — security, identity, data, payment, and operational trust boundaries
- https://mkety.com/infrastructure — Mkety infrastructure and customer deployment-domain architecture
- https://mkety.com/docs — public documentation
- https://mkety.com/pricing — public self-service pricing
- https://mkety.com/enterprise — custom and Enterprise delivery
- https://app.mkety.com — authenticated Mkety Platform control plane
- https://media.mkety.com — Mkety Media
- https://trade.mkety.com — specialized Trading access
- *.mkety.app — customer preview and production deployment hostnames

## Mkety AI provider support
The current Mkety public AI runtime includes executable provider adapters for:
- OpenAI
- Azure OpenAI
- Google Gemini
- Google Vertex AI
- Cloudflare Workers AI
- AWS Bedrock

AWS Bedrock routes include approved Anthropic Claude and Amazon Nova model families in the current Mkety registry. Direct Anthropic, OpenRouter, Groq, and other provider routes may be added through the Mkety provider abstraction when implemented and approved.

## Mkety Workspaces
AI Workspace: agents, knowledge/RAG, tools/actions, model choice, testing, versions, publishing, API access, run history, and usage visibility.
Automation Workspace: manual/webhook/scheduled triggers, API/HTTP actions, transforms, conditions, agent actions, protected configuration, retries, execution history, and usage visibility.
Deploy Workspace: managed web/API/serverless deployment, preview and production environments, environment configuration, domains, HTTPS, logs, deployment state/history, and usage visibility.
Trading Workspace: specialized Custom/Enterprise trading automation and infrastructure.

## Infrastructure
Mkety presents one product/control layer while using selected infrastructure providers behind protected service boundaries. The current architecture uses Cloudflare where appropriate for edge/serverless, DNS, CDN, routing, Workers, R2, and customer hostname delivery, and OCI for persistent backend/compute requirements including PostgreSQL, Redis, and managed services.

## Important boundaries
- mkety.com is public and indexable.
- app.mkety.com is the authenticated customer platform.
- mkety.app is reserved for customer application/deployment namespaces rather than the Mkety dashboard.
- Provider credentials and secrets are never public.
- Browser payment redirects do not settle payments; settlement requires verified server-side provider evidence.
`;

export function GET() {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
