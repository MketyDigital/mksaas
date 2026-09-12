# Integrations

Third-party integrations use OAuth2, API keys, signed webhooks, or other provider-specific credentials for **external API access**. They are separate from Mkety application sign-in.

Mkety owns the application authentication/session/authorization boundary. ZITADEL is the initial replaceable OIDC sign-in adapter. Integration OAuth tokens must not be treated as Mkety application sessions or identity-provider configuration.

The Platform currently includes **GitHub** as the reference OAuth integration. Additional integrations can follow the same scoped pattern and use `integration_sync_control` when synchronization state is required.

---

## GitHub (OAuth2)

GitHub connection lets an authenticated Mkety user authorize the Platform to call the GitHub API on that user's behalf.

### Configuration

1. Register an OAuth App at GitHub Developer Settings.
2. Add the exact redirect URI used by the environment:
   - Local: `http://localhost:3000/api/integrations/github/callback`
   - Deployed environment: `<app-origin>/api/integrations/github/callback`
3. Configure the optional integration credentials:

```env
GITHUB_CLIENT_ID="your-client-id"
GITHUB_CLIENT_SECRET="your-client-secret"
```

If those values are absent, the GitHub integration should remain disabled; they are not required for Mkety sign-in.

### OAuth2 flow

- Authorization URL: `GET https://github.com/login/oauth/authorize`
- Token URL: `POST https://github.com/login/oauth/access_token`
- Flow: authorization code.

### App routes

| Route                                   | Method | Description                                                                                                            |
| --------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| `/api/integrations/github/connect`      | GET    | Requires a Mkety session. Redirects the user to GitHub; supports a bounded optional `returnUrl`.                       |
| `/api/integrations/github/callback`     | GET    | Exchanges the GitHub code, persists the external integration account, then redirects to the approved return location. |
| `/api/integrations/github/user-connect` | GET    | User-level GitHub connection flow.                                                                                     |

### Stored data

GitHub integration tokens currently use the existing generic `accounts` persistence structure retained by the Platform:

- `provider`: `github`
- `providerAccountId`: GitHub user ID
- `access_token`

The table's historical origin does **not** make Auth.js part of the current Mkety Auth architecture. It is currently a persistence structure used by integration code. Any future replacement should be handled as a dedicated integration-data migration rather than by reintroducing Auth.js.

One GitHub connection is maintained per user; reconnecting replaces the prior connection according to the current integration implementation.

### Using the API from code

```ts
import { getValidAccessToken, githubFetch, isGithubConfigured } from '@/features/github';

const tokens = await getValidAccessToken(userId);
if (tokens) {
  const user = await githubFetch('/user', tokens);
}
```

---

## Outbound webhooks

Mkety includes an outbound webhook system with tenant-scoped configuration and delivery tracking.

Tenants can register endpoints for supported Platform events. Delivery attempts are tracked for auditing/retry behavior according to the current webhook service implementation.

### Admin UI

Admins with the required permission can manage outbound webhook settings from the tenant administration surfaces.

This outbound integration system is separate from the **Automation inbound webhook trigger foundation** implemented under the Automation workspace.

---

## Adding a new integration

Follow the current GitHub pattern unless a newer integration architecture has been approved:

1. Create a feature module in `src/features/<integration-name>/`.
2. Add provider callback/connect routes under `src/app/api/integrations/<integration-name>/`.
3. Keep provider OAuth tokens separate from Mkety Auth sessions.
4. Scope persisted credentials to the correct user/tenant boundary.
5. Use `integration_sync_control` when the integration performs synchronization.
6. Add required environment validation without introducing provider-specific names into the Mkety Auth contract.
7. Document redirect URIs, token storage, revocation and failure behavior.

For application authentication, use [AUTHENTICATION.md](./AUTHENTICATION.md) and `docs/MKETY_AUTH_SOURCE_OF_TRUTH.md`.
