# Mkety Automation Internal Execution Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute deterministic internal Automation nodes inside the existing manual run lifecycle without enabling HTTP, AI, webhook, retry, or other external side effects.

**Architecture:** Add a pure internal execution kernel beside the manual-run foundation. The server action keeps authorization, preflight, concurrency, and persistence; the kernel owns definition inspection, interpolation, transform execution, condition evaluation, skip behavior, and structured output. Future HTTP and Agent adapters extend this orchestration boundary instead of creating another runtime.

**Tech Stack:** TypeScript, Next.js server actions, Drizzle ORM, Jest, React Testing Library, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-06-mkety-automation-internal-execution-kernel-design.md`

## Global Constraints
- Automate remains independent from AI.
- Manual and future webhook triggers converge on the same execution pipeline.
- `workflowRuns` remains the audit envelope.
- Executions remain tenant/project scoped, auditable, observable, bounded, and failure-aware.
- No HTTP requests, AI calls, webhook endpoints, retries, credentials, OAuth, billing, deployment, or Trading behavior.
- No arbitrary JavaScript, `eval`, dynamic imports, or executable expressions.
- Reuse existing transform `input`/`mapping` and condition draft fields.

### Task 1: Internal execution kernel
- [x] Add failing tests for trigger, transform, interpolation, conditions, skip behavior, blocked nodes, malformed mapping, and non-mutation.
- [x] Verify red state in GitHub Actions: missing kernel module.
- [x] Implement the pure kernel.

### Task 2: Manual run lifecycle integration
- [x] Replace safe-noop output with internal execution output.
- [x] Preserve authorization, preflight, concurrent-run guard, and queued/running/completed/failed persistence.

### Task 3: UI copy and smoke coverage
- [x] Describe internal-only execution accurately without new external-runtime controls.
- [x] Add kernel tests to focused smoke coverage.

### Task 4: Full verification
- [ ] Push implementation commit.
- [ ] Verify tests, lint, type-check, build, and focused workspace smoke.
- [ ] Debug only concrete failures.
- [ ] Return PR to draft after verification if development continues.