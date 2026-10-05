# Mkety Self-Hosted AI Connectivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the central Mkety runtime call approved self-hosted OpenAI-compatible model services through an explicit, secured connectivity path, including private services where configured.

**Architecture:** Keep public OpenAI-compatible HTTPS connections on the existing validated egress path. For private services, use a statically configured Cloudflare Workers VPC Service binding to a registered destination; a customer-supplied URL must never select a network destination at request time. Keep provider connection secrets, tenant authorization, and model routing in the central AI service.

**Tech Stack:** TypeScript, Cloudflare Workers VPC service bindings, Cloudflare Tunnel, Wrangler, existing outbound URL security helpers, Jest.

**Spec:** `docs/superpowers/specs/2026-10-05-mkety-central-ai-provider-runtime-design.md`

## Global Constraints

- Do not change or route traffic through standalone Assist.
- Never allow arbitrary customer URLs, private IPs, redirects, or DNS changes to become unrestricted Worker egress.
- Bind only reviewed VPC Services; isolate each provider connection to its configured service.
- Keep credentials encrypted and scoped; redact connection secrets and prompts from logs.
- Workers VPC is documented as beta at plan date; verify availability, limits, account roles, and compatibility before production reliance.
- No production private endpoint is enabled until the endpoint owner, connectivity, TLS, and rollback are verified.

## Review Focus

- A public endpoint redirects to a prohibited address — test redirect rejection in Task 1.
- A customer enters a private IP or cloud metadata URL — test public URL validation fails in Task 1.
- A tenant chooses another tenant’s private connection — test ownership and project scope in Task 2.
- A request routes to a VPC binding that was not configured for the connection — test binding allowlist enforcement in Task 3.
- A private endpoint with an invalid TLS certificate or health response is treated as ready — test validation fails closed in Task 4.

---

## File map

Modify:

- `src/features/ai-runtime/providers/external-types.ts`
- `src/features/ai-runtime/providers/external.ts`
- `src/features/ai-runtime/providers/external-http.ts`
- `src/features/ai-runtime/server/provider-connections.ts`
- `src/features/ai-runtime/server/provider-connection-actions.ts`
- `src/features/ai-runtime/providers/runtime.cloudflare.ts`
- `wrangler.jsonc` and its preview environment only after local/type validation
- generated Cloudflare Worker binding types, following the repo’s current mechanism

Add:

- focused tests alongside existing provider and connection tests
- a private-connection health-validation path if no existing validation operation covers it

---

### Task 1: Define a safe public/private connection contract

**Files:**
- Modify: `src/features/ai-runtime/providers/external-types.ts`
- Modify: `src/features/ai-runtime/server/provider-connections.ts`
- Add: provider-connection endpoint tests

**Interfaces:**
- Produces: a discriminated OpenAI-compatible connection mode, `public-https` or `private-vpc`.
- A private connection stores a reviewed VPC Service key and endpoint path; it does not store a request-controlled host, port, or raw binding identifier.

- [ ] **Step 1: Add failing tests** for public HTTPS acceptance, HTTP rejection, private IP rejection in public mode, metadata host rejection, and private mode requiring a registered VPC Service key.
- [ ] **Step 2: Run** the focused connection tests. Confirm private-mode registration fails before implementation.
- [ ] **Step 3: Implement** the discriminated provider-connection contract. Continue using `assertPublicHttpsUrl` for public mode and reject any private endpoint fields in that mode.
- [ ] **Step 4: Run** the focused tests. Expected: only the configured public or private mode can be saved.
- [ ] **Step 5: Commit** as `feat: define secured self hosted provider connections`.

### Task 2: Add statically bound private provider adapters

**Files:**
- Modify: `src/features/ai-runtime/providers/runtime.cloudflare.ts`
- Modify: `src/features/ai-runtime/providers/external.ts`
- Modify: `src/features/ai-runtime/providers/external-http.ts`
- Add: `src/features/ai-runtime/providers/private-vpc.test.ts`

**Interfaces:**
- Consumes: the registered `privateServiceKey` from Task 1.
- Produces: a resolver that maps an approved service key to a Worker VPC Service binding and performs OpenAI-compatible `fetch` calls through that binding.
- Only service keys in the deployed binding allowlist may resolve. Request parameters cannot override the binding destination.

- [ ] **Step 1: Write failing adapter tests** for allowed binding selection, unknown binding rejection, preserved HTTPS Host/SNI behavior, bounded body/response size, timeout, and no public-fetch fallback after a VPC error.
- [ ] **Step 2: Run** `pnpm test -- src/features/ai-runtime/providers/private-vpc.test.ts`. Confirm the private adapter cases fail.
- [ ] **Step 3: Add** typed VPC binding access and route requests through the selected binding’s `fetch` method. Preserve model path and authorization header behavior without logging the secret or body.
- [ ] **Step 4: Run** the focused tests. Expected: unregistered service keys fail before any network call and VPC failures return sanitized errors.
- [ ] **Step 5: Commit** as `feat: call self hosted models through vpc bindings`.

### Task 3: Bind approved VPC Services in Worker configuration

**Files:**
- Modify: `wrangler.jsonc` and its preview environment.
- Add: a Worker config assertion test following existing deployment/config validation patterns.

- [ ] **Step 1: Write a config test** that the private inference binding list is explicit, non-empty only for configured environments, and does not include customer-provided binding names.
- [ ] **Step 2: Run** the config test and confirm it fails before configuration exists.
- [ ] **Step 3: Add** named VPC Service bindings with IDs supplied by the approved deployment environment; use remote bindings for preview validation where that environment supports them.
- [ ] **Step 4: Validate** Wrangler configuration with the repository’s installed Wrangler version and run `pnpm build`.
- [ ] **Step 5: Commit** as `chore: bind approved private ai services`.

### Task 4: Add connection health validation and release gate

- [ ] **Step 1: Write failing tests** for health success, unreachable service, TLS failure, malformed OpenAI-compatible response, timeout, and credential redaction.
- [ ] **Step 2: Implement** a bounded health probe using the same registered VPC binding/model route but a non-generative health/model-list endpoint where the provider supports it; do not silently run billable inference as a probe.
- [ ] **Step 3: Run** the connection health tests and the provider suites.
- [ ] **Step 4: Document** Workers VPC beta/limits, owner prerequisites, TLS policy, health state, and rollback in the central AI operator guide.
- [ ] **Step 5: Commit** as `feat: validate self hosted ai connections`.

### Task 5: Verify private connectivity safety

- [ ] **Step 1: Run** `pnpm test -- src/features/ai-runtime/providers src/features/ai-runtime/server/provider-connections.test.ts`.
- [ ] **Step 2: Run** `pnpm type-check` and `pnpm build`.
- [ ] **Step 3: Verify** untrusted hostnames never reach global `fetch` in private mode and only static VPC binding keys select private destinations.
- [ ] **Step 4: Keep production bindings disabled** until a named endpoint, Worker environment, TLS certificate, VPC Service, and rollback are checked.

---

## Completion gate

This plan depends on the central provider contract. Cloudflare Workers VPC service bindings are documented at [Workers VPC Services](https://developers.cloudflare.com/workers-vpc/configuration/vpc-services/) and use explicitly configured service bindings; verify current beta status before deployment.
