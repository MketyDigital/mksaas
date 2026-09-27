# Mkety AI Runtime & Gateway Foundation — Implementation Plan

Date: 2026-09-27

This plan implements the design in `docs/MKETY_AI_RUNTIME_GATEWAY_ARCHITECTURE.md`. It is subordinate to `AGENTS.md` and the current commercial source of truth.

## Goal

Create a safe first foundation for a Mkety-owned AI API/runtime that can later power AI Workspace and Enterprise AI Instances while supporting Cloudflare Workers AI, BYOK and approved private/self-hosted providers.

## First implementation slice

Keep the first slice deliberately narrow. It must not provision customer domains, mutate Cloudflare AI Gateway secrets, create paid inference, or reroute the existing production Agent Builder.

### Data model

Add new additive migrations for:

- AI API keys;
- AI model catalog;
- AI model aliases;
- AI routes/policies;
- AI provider-connection metadata/secret references;
- AI request/run records;
- AI budget records.

Do not store plaintext customer/provider secrets.

### API-key service

Implement:

- `mk_ai_live_` and optional `mk_ai_test_` key generation;
- SHA-256/HMAC-backed one-way storage consistent with the security level used by current Mkety API-key services;
- show once;
- tenant/project ownership;
- revoke;
- expiry;
- scopes;
- last-used timestamp;
- safe prefix display;
- audit context.

### Model catalog

Model catalog must be server-owned and capability-based.

Minimum capability flags:

- text;
- vision;
- embeddings;
- tools;
- reasoning;
- structured output;
- context/output limits.

No provider call occurs merely because a row exists.

### Runtime contract

Create a provider-neutral request/result contract with:

- tenantId;
- projectId;
- apiKeyId or first-party actor context;
- model alias/native requested model;
- messages/input;
- max output;
- tools/structured-output declarations;
- metadata/idempotency key;
- normalized usage;
- normalized finish/error state.

### Initial endpoints

Implement without paid-provider enablement first:

- `GET /api/v1/ai/models`;
- `POST /api/v1/ai/chat/completions`.

The route should be shaped for the external `api.mkety.com/v1/ai` host rewrite while remaining testable as an application route.

Before any real inference provider is enabled, the endpoint may return a controlled provider-unavailable error after authentication, entitlement, model and budget validation.

### Entitlements

Add capability-oriented entitlements rather than tying the whole product to individual providers.

Candidate keys:

- `ai.api`;
- `ai.byok`;
- `ai.private_model`;
- `ai.enterprise_instance`;
- `ai.channel.website`;
- `ai.channel.telegram`.

Existing provider-specific entitlement keys remain until a deliberate migration removes/replaces them.

### Usage

Retain existing immutable meters and introduce new ones only with tests.

Potential additions:

- `ai.request`;
- `ai.tokens.cached_input`;
- `ai.embedding.tokens`;
- `ai.image.input`;
- `ai.image.output`;
- `ai.audio.input_seconds`;
- `ai.audio.output_seconds`.

Provider cost is accounting metadata/a dedicated cost record, not a fake usage quantity.

### Budget authorization

Before managed inference:

- resolve tenant/project;
- resolve entitlement;
- resolve model/route;
- enforce request/key/project/tenant limits;
- verify sufficient prepaid/credit authorization under the final commercial design;
- reject before upstream call when not authorized.

A later provider adapter must not bypass this service.

## Cloudflare slice after foundation

Once the foundation is green:

1. create the Workers AI adapter;
2. route it through Cloudflare AI Gateway;
3. configure a non-production gateway;
4. add current model catalog values only after live documentation/API verification;
5. run tiny controlled inference acceptance;
6. verify normalized usage and Cloudflare/provider cost;
7. keep production enablement off until explicitly promoted.

## BYOK slice

- add provider-connection create/test/revoke operations;
- secrets go into the chosen secure secret mechanism, with only references persisted in Mkety DB;
- enforce BYOK-only no-wholesale/no-Mkety-paid-fallback behavior;
- prove a failed/missing BYOK credential cannot consume a Mkety-owned upstream account;
- meter Mkety platform features separately from customer provider cost.

## Existing AI Workspace migration

Do not change `src/features/ai/lib/provider.ts` to a remote runtime in the first DB/API slice.

After the Mkety AI runtime has production-like tests:

1. add a first-party internal runtime client;
2. test parity for streaming and non-streaming agent calls;
3. preserve Knowledge and Tools;
4. preserve Automation's current tool-disabled contract;
5. compare usage;
6. migrate testAgent;
7. migrate runAgent;
8. migrate published/automation consumers;
9. remove direct provider paths only after parity and rollback evidence.

## Enterprise instance slice

After the runtime/API is stable:

- instance CRUD/versioning;
- attach published agent;
- website channel;
- Telegram channel;
- managed `*.mkety.app` hostname;
- custom hostname request/provisioning through the existing Deploy/domain architecture;
- per-instance route/BYOK/private model policy;
- human escalation;
- conversation/run analytics;
- audit.

## Acceptance requirements

Before enabling any paid Mkety-managed inference:

- key auth fail-closed;
- revoked/expired keys rejected;
- tenant/project isolation;
- model not allowed rejected;
- entitlement absent rejected;
- budget absent/exhausted rejected;
- max token/body limits enforced;
- provider timeout/failure sanitized;
- no secret printed or stored in run logs;
- usage idempotency;
- upstream success + local accounting failure has an explicit repair path that does not unknowingly duplicate upstream spend;
- BYOK cannot silently fall back to a Mkety credential;
- production model prices/capabilities revalidated.

## Non-goals for the first implementation slice

- no production DNS mutation;
- no customer custom-hostname provisioning;
- no paid Cloudflare AI calls;
- no dedicated GPU provisioning;
- no replacement of Public Mkety AI's public-only trust boundary;
- no change to Trading execution authority;
- no bulk social integrations;
- no production reroute of existing Agent Builder.
