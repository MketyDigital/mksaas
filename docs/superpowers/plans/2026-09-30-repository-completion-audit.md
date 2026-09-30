# Repository Completion Audit Implementation Plan

**Goal:** Reverify current main, fix reproduced defects, and distinguish repository verification from production/customer acceptance.

**Architecture:** Preserve central Mkety services and commercial gates. Reuse request-scoped database contexts for Mail APIs. Execute the real gateway against controlled transport/provider boundaries to test protocol state without production data.

**Tech Stack:** TypeScript, Vinext, Cloudflare Hyperdrive, Drizzle/Postgres.js, Node TLS, Jest.

**Spec:** `docs/handoffs/2026-09-30-final-platform-completion.md`, `AGENTS.md` overrides.

## Constraints

- No secret values in output, Git, or documents.
- Preserve tenant isolation, verified settlement and immutable accounting.
- Keep external clients and production customer inference gated until live acceptance succeeds.
- Baseline SHA: `65e1fcebefbffa1b9304d86360eeb3a2d0c77faa`.

## Tasks

- [x] Inspect handoffs, current main, workflow runs and local verification commands.
- [x] Reproduce Mail message-index request-context failure; wrap all five internal gateway routes in the existing request DB lifecycle, retaining authorization before database access.
- [x] Reproduce gateway pipelining, IDLE termination, read-only flag mutation and failed-backend false-success behavior; serialize command processing and correct these protocol paths.
- [x] Reproduce and fix calendar-date formatting across host time zones.
- [x] Run full tests, type-check, lint, migration baseline and Cloudflare/Vinext build; account for every failure.
- [x] Record current production evidence, remaining customer acceptance gates and integration access limitations in the handoff/status.

## Review focus

Unauthorized requests must not open a database. Separate requests must not share Worker sockets. Pipelined commands must preserve order. EXAMINE must not mutate flags. Provider/backend failures must never report successful reads/writes. Date-only input must preserve its calendar day.
