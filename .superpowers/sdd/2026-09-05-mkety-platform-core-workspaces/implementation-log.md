# Mkety Platform Core Workspaces Implementation Log

## 2026-09-05

- Merged the verified public-site/CMS/control-center foundation into `main`.
- Created `feat/mkety-platform-core-workspaces` from the merged foundation.
- Added design spec and implementation plan.
- Started inline execution.
- Added workspace registry, shared project access guard, workspace hub, workspace shell, empty-state component, and route shells.
- Converted project detail page from agent-only to workspace hub.
- Moved agent creation/listing to `/ai` workspace route.
- Added focused workspace smoke workflow.

## Guardrails

- Do not add trading execution data in this branch.
- Do not implement billing ledger or wallet movement in this branch.
- Do not implement deployment provider automation in this branch.
- Keep all workspace route access server-side and tenant/project scoped.
