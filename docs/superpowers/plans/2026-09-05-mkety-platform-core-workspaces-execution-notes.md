# Mkety Platform Core Workspaces Execution Notes

## Current execution mode

Inline execution in the current session.

## First implementation batch

The first implementation batch intentionally builds the project workspace shell without adding heavy product data models.

Implemented boundaries:

- AI is available and reuses the existing agent creation/listing flow.
- Automation is a planned shell only.
- Deploy is a planned shell only.
- SolutionHub is a planned shell only.
- Trading is custom/enterprise display and intake only.

Not implemented in this batch:

- Real workflow engine changes.
- Real deployment infrastructure automation.
- Real solution installation flow.
- Real trading accounts, signals, broker links, copy trading, or execution tables.
- Billing ledger, wallet, or money movement.

## Verification target

The branch must keep these green:

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

The focused workspace smoke workflow additionally runs:

```bash
pnpm test -- src/features/projects/workspaces/registry.test.ts src/features/projects/workspaces/WorkspaceHub.test.tsx src/features/projects/workspaces/WorkspaceShell.test.tsx
pnpm type-check
```
