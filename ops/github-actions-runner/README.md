# Mkety production GitHub Actions runner

This folder is a Coolify-deployable, repository-scoped self-hosted GitHub Actions runner for production database work that must reach Mkety's private PostgreSQL service on the same OCI/Coolify destination.

## Why this exists

GitHub-hosted runners cannot resolve Coolify's internal database hostname. This runner executes only jobs explicitly labeled `mkety-production` from inside the OCI/Coolify network so `PRODUCTION_DATABASE_URL` can remain private and PostgreSQL does not need a public port.

## Coolify deployment

1. Create a new application from the `MketyDigital/mksaas` repository.
2. Use branch `fix/production-db-private-runner` while this change is under review.
3. Select the Docker Compose build pack and set the compose file path to `ops/github-actions-runner/docker-compose.yml`.
4. On the same OCI server/destination as the production database, enable **Connect To Predefined Network**. Do not publish any ports and do not assign a public domain.
5. Add these runtime variables in Coolify:
   - `RUNNER_URL=https://github.com/MketyDigital/mksaas`
   - `RUNNER_TOKEN=<temporary repository runner registration token>`
   - `RUNNER_NAME=mkety-production-oci`
   - `RUNNER_LABELS=mkety-production`
   - `RUNNER_WORKDIR=_work`
6. Deploy once. The named volume persists the runner registration and work directory across ordinary container restarts.
7. In GitHub, verify the runner appears under **Settings -> Actions -> Runners** and is Online/Idle with the `mkety-production` label.

## Registration token

Generate the temporary registration token from **GitHub -> MketyDigital/mksaas -> Settings -> Actions -> Runners -> New self-hosted runner**. Do not commit or paste the token into repository files. Store it only as a masked Coolify runtime variable.

The registration token is used only when the persistent runner state does not already contain `.runner`. Ordinary restarts reuse the persisted registration and do not re-register.

If the runner registration is removed in GitHub, create a fresh temporary registration token, update `RUNNER_TOKEN`, delete the runner's persistent state volume, and redeploy.

## Security properties

- No inbound ports are published.
- No domain is required.
- The container drops Linux capabilities and enables `no-new-privileges`.
- `/tmp` is a restricted tmpfs.
- The official GitHub-maintained runner image is pinned to `ghcr.io/actions/actions-runner:2.337.0`.
- The runner receives no Docker socket.
- The production workflow must target `[self-hosted, linux, mkety-production]`; normal PR workflows must never target this label.
- Keep `PRODUCTION_DATABASE_URL` in GitHub's protected `production` environment and keep PostgreSQL private.

## Networking

Coolify Compose resources use a resource-specific network by default. **Connect To Predefined Network** must be enabled so this runner can reach standalone applications/databases attached to the selected Coolify destination network. Do not add a public PostgreSQL port as a workaround.

## Upgrade policy

Upgrade the pinned GitHub runner image deliberately after reviewing GitHub's runner release notes. Do not switch this production runner to a floating `latest` tag.
