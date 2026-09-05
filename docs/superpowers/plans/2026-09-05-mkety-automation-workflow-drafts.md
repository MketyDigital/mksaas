# Mkety Automation Workflow Draft Shell Plan

## Phase

Automation Workflow Creation Draft Shell

## Implementation plan

1. Add failing tests for workflow draft helpers.
2. Add draft helper functions for slugging, default definition, and normalized draft insert values.
3. Add a server action that creates draft workflow records with tenant/project manager checks.
4. Add a draft creation form component with a non-manager boundary state.
5. Wire the form into `/t/[tenant]/projects/[project]/automation`.
6. Expand focused workspace smoke coverage.
7. Open PR, verify focused smoke and full CI.
8. Mark ready and merge after green checks.

## Safety boundaries

- Draft records only.
- Manual trigger only.
- Empty definition by default.
- No runtime execution.
- No webhook activation.
- No action dispatch.
- No retry execution.
- No billing, wallet, usage, deployment, or trading changes.

## Verification target

- `pnpm test`
- `pnpm type-check`
- `pnpm lint`
- `pnpm build`
- Focused workspace smoke with workflow draft tests included.