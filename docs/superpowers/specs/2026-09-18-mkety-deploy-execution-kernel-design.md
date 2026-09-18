# Mkety Deploy Execution Kernel Design

**Status:** APPROVED FOR IMPLEMENTATION  
**Date:** 2026-09-18

## Objective

Add the provider-neutral execution boundary that future Cloudflare/OCI deployment adapters will plug into, without enabling any real infrastructure mutation yet.

## Scope

The kernel owns:

- a stable deployment-provider adapter contract;
- tenant/project/application/environment execution context;
- deployment lifecycle recording through the existing `deployments` table;
- queued -> running -> completed/failed transitions;
- provider reference capture when supplied;
- sanitized provider failure handling;
- a hard block on protected/production environments in this slice.

## Safety boundary

This slice must not:

- register or call a real Cloudflare, OCI, Coolify, DNS, or custom-hostname provider;
- expose credentials or environment secrets;
- add a UI action that can trigger a deployment;
- execute protected/production environments;
- create public preview/production URLs;
- mutate DNS, custom domains, SSL, routing, or origin configuration;
- implement rollback execution.

## Provider contract

A deployment provider adapter receives already-authorized, tenant/project-scoped deployment context and returns a provider-neutral result.

The adapter must not own Mkety authorization, tenant resolution, or deployment-history persistence.

## Orchestration

The kernel:

1. validates execution context;
2. rejects protected environments;
3. creates the deployment audit envelope;
4. marks the deployment running;
5. calls the injected adapter;
6. marks completed when the adapter succeeds;
7. marks failed with sanitized error semantics when the adapter throws.

No raw provider error object or secret may be persisted or returned.

## Production boundary

Production remains protected and non-executable. A later slice must define explicit production approvals, rollback requirements, audit identity, provider credential boundaries, and operational controls before production execution can be enabled.

## Next slice

After this kernel is verified, implement one isolated non-production provider adapter/candidate environment with real external verification before exposing any customer-facing deployment action.
