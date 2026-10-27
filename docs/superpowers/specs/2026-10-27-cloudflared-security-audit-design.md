# Cloudflared Security Audit Design

## Intent
Verify the versions of connected `cloudflared` clients for every non-deleted Cloudflare Tunnel in Mkety's Cloudflare account after Cloudflare's eMudhra certificate-compromise notice.

## Goals and constraints
- Use GitHub Actions' existing production environment secrets for Cloudflare account ID and API token.
- Make Cloudflare API GET requests only; do not alter tunnels, DNS, routes, origins, certificates, or tokens.
- Report only tunnel name/status, connector architecture, versions, and counts. Never emit IDs, origin IPs, credentials, or raw API errors.
- Treat versions below `2026.10.2` as requiring upgrade. Treat macOS connectors below `2026.10.3` as requiring installation-method review because the notice distinguishes Homebrew from other installs.
- An inactive tunnel with no connected clients is reported as inactive/unverified, not as evidence of a patched host.

## Approaches
1. Read the version in the Cloudflare dashboard manually. Fast, but does not leave a repeatable account-wide report.
2. Extend the production bridge diagnostic. Reuses its secret path, but mixes a security audit into a separate diagnostic and risks running extra production inspection steps.
3. Add a dedicated, manual, read-only GitHub Actions audit (selected). It can query every tunnel's connection endpoint, report sanitized client versions, and be run again without affecting traffic.

## Scope and exclusions
The audit covers currently connected clients visible from Cloudflare's Tunnel connections API. It does not restart or upgrade them and cannot identify an offline host's installed binary. Once results identify any stale client, choose an upgrade path based on the host and replica count; do not disable TLS certificate verification.
