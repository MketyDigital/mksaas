# Mkety Platform Implementation Blueprint

This repository is now the Mkety foundation. The goal is a portable SaaS control plane that can run on Vercel during development/testing and later on OCI/Coolify without redesigning the application.

## Product layers

1. **Mkety Core Platform**
   - multi-tenant workspaces
   - users, teams, memberships, roles and permissions
   - projects/resources
   - platform settings
   - audit logs and notifications

2. **Mkety AI Core**
   - platform-wide AI assistant/copilot
   - provider/model abstraction
   - AI usage accounting
   - future tool calling and RAG

3. **AI Agent Builder**
   - agent definitions, instructions, models, tools and knowledge
   - versions and testing
   - deployment/runtime integration
   - Flowise remains an optional external/on-demand implementation where appropriate

4. **AI App Builder**
   - prompt-to-application workflow
   - project/files/preview/deployment lifecycle
   - external app-builder integrations where they are the better infrastructure choice

5. **Automation**
   - workflows, triggers, actions, schedules and webhooks
   - Activepieces remains optional/on-demand rather than Day-1 infrastructure

6. **Cloud/deployment control plane**
   - GitHub integration
   - deployment providers
   - Cloudflare DNS/custom domains
   - Coolify API integration for Mkety-owned/self-hosted workloads

7. **Billing and usage**
   - products/plans
   - subscriptions
   - wallet/credit ledger
   - AI/deployment usage metering
   - Selar primary payments
   - NOWPayments crypto payments

## Infrastructure policy

Keep the control plane small. Do not install Flowise, Activepieces, LiteLLM, Qdrant, model runtimes, MT5/Telegram workloads or arbitrary customer applications on the Day-1 OCI VM.

Use external/on-demand infrastructure when a workload requires it. Cloudflare, ZITADEL, GitHub and payment providers are integrations, not services that need to run inside the Mkety VM.

## Portability rule

The application should prefer standard PostgreSQL, Redis, Docker, OIDC/OAuth, REST APIs and provider-neutral AI interfaces. Avoid making Supabase or Vercel-only backend features a permanent dependency.

## Current foundation already present

- tenant-scoped routing under `/t/{tenant}`
- tenant memberships and tenant RBAC
- multiple roles per tenant membership
- team/member/invite administration
- tenant custom-domain records and routing hooks
- tenant-scoped files and webhooks
- GitHub integration/control-plane features
- persistent AI assistant conversations
- Vercel AI SDK-based streaming chat
- feature flags for AI and test authentication

## Implementation phases

### Phase 0 — Foundation hardening

Verify tenant isolation, auth boundaries, route protection, migrations, environment validation, testing and deployment portability.

### Phase 1 — Mkety AI Core

Centralize provider/model selection, add usage accounting hooks, and make the assistant provider-neutral. Do not require fake credentials for disabled providers.

### Phase 2 — Workspace/product model

Introduce first-class projects/resources and connect all new features to the active tenant/workspace.

### Phase 3 — Agent Builder

Add persistent agent definitions, versions, tools, knowledge references, testing and deployment state.

### Phase 4 — App Builder

Add AI application-generation projects, files, previews and deployment lifecycle.

### Phase 5 — Automation

Add workflow definitions and execution infrastructure; integrate Activepieces when the feature requires it.

### Phase 6 — Cloud and domains

Complete Cloudflare/DNAPI/custom-domain/deployment provider integrations and Coolify control-plane operations.

### Phase 7 — Billing and credits

Add authoritative product/plan records, wallet/ledger, usage events, subscriptions, Selar and NOWPayments webhooks.

### Phase 8 — Production hardening

ZITADEL production identity integration, rate limits, secrets management, observability, backups, disaster recovery and security review.

## Development rule

Every phase should build and test on the current Vercel deployment first. Do not migrate the production stack to OCI until the completed phase has passed functional and security checks.
