# Cloudflared Security Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repeatable, read-only Actions workflow that reports every connected Cloudflare Tunnel client version and flags versions that need upgrade or review.

**Architecture:** A standalone manual workflow checks out the repository, runs a small dependency-free Node.js audit helper and its `node:test` suite, then queries the Cloudflare account using existing production environment secrets. The helper paginates all non-deleted tunnels and each tunnel's connections endpoint and emits only sanitized tunnel names/status, connector architecture, version, and counts.

**Tech Stack:** GitHub Actions, Node.js built-ins, Cloudflare Tunnel API.

**Spec:** `docs/superpowers/specs/2026-10-27-cloudflared-security-audit-design.md`

## Global Constraints
- Cloudflare API access is read-only.
- Minimum `cloudflared` version is `2026.10.2`; macOS below `2026.10.3` requires install-method review.
- Do not print tokens, tunnel IDs, connector IDs, origin IPs, or raw API errors.
- Manual workflow dispatch only; do not run as part of deployment or push events.
- Do not alter tunnel configuration, DNS, routes, origins, certificates, or tokens.

## Review Focus
- Pagination over more than 100 tunnels and connections: return all rows or fail closed.
- Missing or unparsable versions: mark unknown and fail the audit.
- macOS `2026.10.2`: require install-method confirmation because the notice's Homebrew exception cannot be inferred from API data.
- API failures: include only HTTP status and a fixed safe message, never raw response bodies.
- No active connections: report as no active clients and fail the audit for a manual offline-host check.
- Output: exclude all resource IDs and origin IP addresses.

---

### Task 1: Read-only connector-version audit

**Files:**
- Create: `scripts/cloudflared-security-audit.mjs`
- Test: `scripts/cloudflared-security-audit.test.mjs`
- Create: `.github/workflows/mkety-cloudflared-security-audit.yml`
- Create: `docs/superpowers/specs/2026-10-27-cloudflared-security-audit-design.md`
- Create: `docs/superpowers/plans/2026-10-27-cloudflared-security-audit.md`

**Interfaces:**
- `fetchTunnelAudit({ accountId, apiToken, fetcher })` returns sanitized tunnel and connected-client assessments.
- `assessConnectorVersion(version, arch)` classifies the fixed-version floor and macOS review exception.
- `requiresFollowUp(assessment)` keeps unknown, old, macOS-review, and offline tunnels from producing a green audit.

- [ ] Write tests first for release-floor assessment, macOS review, complete pagination, safe API errors, and output omission of IDs/IPs/secrets.
- [ ] Run `node --test scripts/cloudflared-security-audit.test.mjs`; confirm the expected missing-module failure before adding the helper.
- [ ] Implement the helper with GET-only API calls and bounded pagination.
- [ ] Re-run `node --test scripts/cloudflared-security-audit.test.mjs`; confirm all cases pass.
- [ ] Add a `workflow_dispatch`-only workflow using the existing `production` environment secrets and the helper/test commands.
- [ ] Validate YAML/workflow syntax and `git diff --check`.
- [ ] Create a PR targeting `main`; do not merge or run any production configuration change as part of this task.
