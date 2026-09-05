# Mkety Platform Core Workspaces Implementation Boundaries

This note protects the first main-app implementation branch from drifting into heavy subsystems too early.

## Included

- Project workspace hub.
- Workspace registry.
- Shared workspace shell UI.
- Server-side project access guard.
- AI workspace route using existing agent data.
- Planned route shells for Automation, Deploy, and SolutionHub.
- Enterprise-only Trading workspace shell.

## Excluded

- New trading database tables.
- Broker integrations.
- Signals, copy trading, execution logs, or MT5/Deriv data.
- Real workflow engine expansion.
- Real deployment provider automation.
- Real solution installation.
- Billing ledger, wallet, credits, or payment movement.

## Reason

Mkety needs a stable authenticated app structure before each heavy product area receives its own model, UI, and verification path. This keeps the branch reviewable and avoids mixing product shell work with high-risk financial, deployment, and billing behavior.
