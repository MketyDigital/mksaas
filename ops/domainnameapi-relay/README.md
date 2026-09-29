# Mkety DomainNameAPI fixed-egress relay

This service exists because DomainNameAPI V2 validates the caller's public outbound IP. The Mkety application runs on Cloudflare Workers, whose ordinary outbound requests must not be assumed to originate from one stable allowlistable address.

## Deployment target

Deploy this container on a controlled Mkety Coolify/VPS host with a stable public outbound IPv4 address.

The service itself listens on port 3000. Put it behind Mkety-managed HTTPS at an infrastructure-only hostname. Do not expose the container port directly to the Internet.

## Required environment

- `MKETY_DOMAIN_RELAY_SECRET`: random secret of at least 32 characters. Configure the same value on the Cloudflare application Worker as `MKETY_DOMAIN_RELAY_SECRET`.
- The Cloudflare application Worker also receives `MKETY_DOMAIN_RELAY_URL=https://<relay-host>`.

DomainNameAPI Reseller ID/API Key values do **not** live in this container. Mkety continues to keep provider credentials encrypted in Platform Service Connections and passes them only inside an authenticated HTTPS relay request.

## DomainNameAPI V2 account configuration

In the DomainNameAPI reseller panel:

1. Use the V2 numerical **Reseller ID** from Integration Details; do not use the reseller-panel username.
2. Use the **Live Environment API Key** for production.
3. Use the displayed OT&E/Test credentials for the sandbox.
4. Add the relay VPS's real public outbound IP to the DomainNameAPI V2 IP whitelist.
5. Do not add GitHub Actions runner addresses as the production allowlist.

## Security contract

The relay:

- accepts only `POST /v1/domainnameapi`;
- accepts only `quote`, `register`, and `renew`;
- maps those operations to fixed DomainNameAPI V2 paths;
- verifies an HMAC-SHA256 signature and 60-second timestamp window;
- rejects duplicate request nonces;
- caps request bodies at 64 KiB;
- never accepts an arbitrary upstream URL or path;
- never logs request bodies, Reseller IDs, or API Keys;
- applies a 20-second upstream timeout.

`GET /health` returns only service readiness metadata.

## Acceptance

Before enabling customer domain checkout:

1. verify the relay health endpoint over HTTPS;
2. determine the VPS's real outbound public IP from the VPS itself and add that exact IP to DomainNameAPI;
3. run an OT&E quote through the relay;
4. run the guarded OT&E register + renew lifecycle acceptance;
5. run a live quote-only check through the relay;
6. keep live registrar mutations behind Mkety verified-settlement and idempotency gates.
