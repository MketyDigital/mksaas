# Mkety Platform Core Workspaces Review Notes

Review focus for this branch:

1. The project page should now act as a Mkety workspace hub instead of only an agent dashboard.
2. The AI workspace should preserve existing agent creation and listing behavior.
3. Planned workspaces should communicate safe next steps without pretending heavy subsystems are complete.
4. Trading should remain enterprise-only and should not create trading-account, broker, signal, copy-trading, or execution data.
5. The shared project access guard should keep all workspace routes authenticated, tenant-scoped, and project-scoped.

Non-goals:

- Billing implementation.
- Deployment provider automation.
- Trading execution.
- Workflow engine expansion.
