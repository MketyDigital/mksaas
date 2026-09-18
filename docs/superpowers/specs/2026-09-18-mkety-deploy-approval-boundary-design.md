# Mkety Deploy Approval Boundary Design

**Status:** APPROVED FOR IMPLEMENTATION  
**Date:** 2026-09-18

## Objective

Add an auditable authorization boundary between Deploy project metadata and real provider execution.

## Scope

- Project admin/manager can request deployment for development/preview/staging only.
- Protected/production environments cannot be requested.
- Requests are tenant/project/application/environment scoped.
- Duplicate pending request per environment is rejected.
- Tenant Platform Control reviewers need `platform:deployments`.
- Reviewer decision is append-style audit state: pending -> approved/rejected.
- Requester and reviewer identities, timestamps, refs and review note are retained.
- Project Deploy shows request status.
- Deployments & Domains control module shows pending approval queue.

## Critical boundary

Approval does **not** execute a deployment in this slice.

No Cloudflare adapter, execution kernel, DNS/custom-domain action, production deployment, provider credential, or rollback action is called from request/review actions.

A later slice may hand an approved request to execution only after a trusted project artifact pipeline exists and exact request-to-execution binding is designed.
