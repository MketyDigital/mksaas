# Mkety Cloudflare Deploy Candidate Adapter Design

**Status:** APPROVED FOR IMPLEMENTATION  
**Date:** 2026-09-18

## Objective

Add the first real Deploy provider adapter behind the merged provider-neutral execution kernel, while limiting all external mutation to an isolated non-production Cloudflare Worker candidate on `workers.dev`.

## Provider boundary

The first adapter uses Cloudflare Workers because Cloudflare is already an approved Mkety edge/deployment provider and the repository has a proven isolated `workers.dev` verification pattern.

The adapter must remain separate from customer-facing routing and the later `*.mkety.app` / custom-domain system.

## Artifact contract

The adapter receives a trusted server-side module artifact from an injected artifact source.

First-slice limits:

- module syntax only;
- explicit main module;
- explicit compatibility date;
- zero Cloudflare bindings;
- at most 20 modules;
- at most 1 MiB total source;
- safe relative module names only.

The adapter does not fetch arbitrary repositories, accept browser-provided source code, or resolve secrets.

## Candidate identity

Every external candidate Worker name must:

- start with `mkety-deploy-candidate-`;
- satisfy the Cloudflare workers.dev DNS-label constraints;
- be derived from the Mkety deployment id;
- remain at or below 63 characters.

The adapter rejects protected or production environments independently of the execution kernel.

## Cloudflare API operations

Allowed operations in this slice:

1. upload the isolated Worker module through the Workers Script API;
2. enable the script on `workers.dev` with Preview URLs disabled;
3. read the account workers.dev subdomain to form the candidate URL;
4. delete the exact candidate Worker.

Not allowed:

- Worker Routes;
- Worker Custom Domains;
- DNS;
- SSL/custom-hostname APIs;
- Hyperdrive/R2/KV/D1/secret bindings;
- `mkety.com`, `app.mkety.com`, `api.mkety.com`, or `origin.mkety.com`;
- `*.mkety.app`;
- production Worker names;
- production execution.

## External verification

A dedicated same-repository PR/manual workflow uses the existing GitHub `preview` environment Cloudflare credentials.

It:

- runs focused adapter tests;
- deploys one tiny fixture Worker through the real adapter;
- verifies the exact marker over the resulting workers.dev URL;
- deletes the candidate in script cleanup;
- runs an `always()` cleanup check to prevent orphan Workers.

No customer data or application secret is included in the fixture.

## Credential boundary

`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` remain GitHub environment secrets/variables for external verification. They are not stored in Mkety database tables and are not exposed to the browser.

## Next boundary

A later slice may connect an authenticated server-side Deploy command to the execution kernel only after:

- artifact provenance is defined;
- entitlement/credit policy is defined;
- authorization/audit identity is explicit;
- candidate retention/cleanup policy is defined;
- customer-facing hostname strategy is approved.

Production and custom-domain execution remain separate later work.
