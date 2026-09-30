const body = `# Mkety

> Mkety helps businesses, organizations and individuals launch and run digital solutions from one connected ecosystem. Customers can start with websites, business email and AI assistance, then add automation, applications and tailored Enterprise delivery. The underlying infrastructure is managed behind the Mkety experience.

## Find the right next step
- Explore public capabilities and straightforward self-service plans at https://mkety.com/pricing; ready customers can choose a plan and complete checkout there.
- Ask Mkety AI through https://mkety.com/contact#mkety-ai for product discovery, public documentation and general support. Account-specific issues and custom requirements go to the human support or Enterprise team when needed.
- Discuss tailored integrations, Enterprise AI, Enterprise Mail and specialized Trading through https://mkety.com/enterprise. Their availability and terms depend on an agreed scope; do not infer a self-service entitlement.
- Security and infrastructure details are described at https://mkety.com/trust and https://mkety.com/infrastructure. Do not infer a certification, uptime guarantee or data-residency promise unless it is explicitly published or agreed.

## Canonical public surfaces
- https://mkety.com/ — public company and product website
- https://mkety.com/platform — Mkety Platform overview
- https://mkety.com/workspaces — AI, Automation, Deploy, and Custom/Enterprise Trading workspaces
- https://mkety.com/trust — security, identity, data, payment, and operational trust boundaries
- https://mkety.com/infrastructure — Mkety infrastructure and customer deployment-domain architecture
- https://mkety.com/docs — public documentation
- https://mkety.com/pricing — public self-service pricing
- https://mkety.com/enterprise — custom and Enterprise delivery
- https://mkety.com/mail — Mkety Mail product overview, public plans, limits and add-ons
- https://mail.mkety.com — authenticated Mkety Mail workspace entry for entitled Mail customers
- https://ai.mkety.com — focused Mkety AI product/console surface; Enterprise AI is separately entitled from the normal AI Workspace
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

## Mkety Mail
Mkety Mail is separately subscribed from the normal Mkety Platform plans. Public monthly plans are Mail Starter $4.99, Mail Growth $9.99 and Mail Business $24.99, with the standard 1/3/6/12-month prepaid discount ladder. Enterprise Mail is custom. Public plans have explicit domain, mailbox, seat, shared-inbox, storage, outbound-message and Customer Update limits; self-service limits fail closed rather than creating surprise postpaid billing; customers upgrade plan or use Enterprise for more capacity. Marketing campaigns remain Coming Soon.

## Enterprise AI
Enterprise AI is separately entitled from the normal AI Workspace. It is the Enterprise product layer for branded customer-facing assistants, production channels, custom domains, API/PaaS use, operator handoff, contracted usage/limits, advanced security, private/dedicated model routing, custom integrations and SLA/support terms where agreed.

## Infrastructure
Mkety presents one product/control layer while using selected infrastructure providers behind protected service boundaries. The current architecture uses Cloudflare where appropriate for edge/serverless, DNS, CDN, routing, Workers, R2, and customer hostname delivery, and OCI for persistent backend/compute requirements including PostgreSQL, Redis, and managed services.

## Important boundaries
- mkety.com is public and indexable.
- app.mkety.com is the authenticated customer platform.
- mail.mkety.com is the authenticated Mkety Mail entry point and reuses Mkety identity/tenant boundaries.
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
