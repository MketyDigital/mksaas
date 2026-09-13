# Mkety Tunnel + Access provisioning trigger

Date: 2026-09-13

Purpose: trigger the isolated diagnostics-branch provisioning workflow after approval of the Tunnel + Access private PostgreSQL architecture.

Safety constraints:
- Frozen production release SHA remains `06bc9d5526e4157f54ab17eedd5873dcabc5e497`.
- No production application route mutation is authorized by this trigger.
- PostgreSQL and Redis remain private.
- Unrelated MKLMS Cloudflare resources remain out of scope.
- Provisioning must fail closed if exact resource identity, permissions, Access protection, Tunnel health, or Hyperdrive creation cannot be verified.
