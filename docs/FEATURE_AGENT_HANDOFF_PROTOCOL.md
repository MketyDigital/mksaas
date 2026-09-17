# Mkety Feature-Agent Handoff Protocol

**Status:** MANDATORY  
**Applies to:** every human or AI agent that changes a feature, workstream, production runtime, deployment, migration, or roadmap state in `mksaas`.

This protocol exists to prevent implementation state, production state, and documentation from drifting apart.

## Completion gate

A feature or workstream is **not complete, merge-ready, VERIFIED, or PRODUCTION** until its handoff/progress state is updated in the same branch or pull request.

Every feature agent must record, before handing work to another agent or ending the workstream:

1. What was requested and the intended outcome.
2. What was already present before the change.
3. What changed, including important files/modules and migrations.
4. Current status using the repository status legend: `PLANNED`, `IN PROGRESS`, `IMPLEMENTED`, `VERIFIED`, `PRODUCTION`, `BLOCKED`, or `DEFERRED`.
5. Tests, type-checks, builds, deployment checks, and runtime verification actually performed, with concrete evidence where available.
6. Database, environment, secret-name, Cloudflare, OCI, domain, or external-service changes.
7. Known blockers, risks, failed checks, and anything intentionally left unresolved.
8. Exact next steps in order, including the next recommended branch/PR/workstream.
9. Related PRs, issues, branches, workflow runs, or deployment references.

Never upgrade a status from `IMPLEMENTED` to `VERIFIED` or `PRODUCTION` without evidence.

## Canonical records

- `docs/MKETY_DEVELOPMENT_CONTINUATION.md` is the long-running operational continuation record. Update it whenever milestone order, current priority, production state, or the recommended next workstream changes.
- `docs/CURRENT_WORKSTREAM_STATUS.md` is the concise current-state pointer. Every material feature/workstream PR must update it before merge.
- Dated or feature-specific handoffs may be added when operational detail would make the canonical continuation document unwieldy.
- `AGENTS.md` remains the architecture/product authority and must be updated when architecture itself changes; routine progress does not belong inside its protected architecture block.

## Mandatory PR/session rule

For any PR that materially changes `src/`, `scripts/`, migrations, deployment configuration, runtime configuration, or production workflows, the feature agent must update `docs/CURRENT_WORKSTREAM_STATUS.md` in that PR.

A feature agent ending a session with unfinished work must still update the status file with the blocker and exact next step. “No update because the work is unfinished” is not acceptable: unfinished work is precisely when a handoff is required.

If a PR truly makes no material feature/workstream state change (for example a spelling-only documentation correction), the PR description must explicitly state that no handoff state changed.

## Required closing report

Every feature-agent closing report must include:

```text
Requested
Already present
Changed
Files/modules affected
Database/environment changes
Tests/typecheck/build
Deployment/runtime verification
Current status
Known blockers/risks
Exact next steps
```

Do not claim work was tested, deployed, verified, or production-ready when that evidence does not exist.
