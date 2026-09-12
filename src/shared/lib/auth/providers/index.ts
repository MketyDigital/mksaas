import { env } from '@/shared/lib/env';

import { createZitadelAdapter } from './zitadel';
import type { IdentityProviderAdapter } from '../types';

export function getIdentityProvider(): IdentityProviderAdapter {
  if (env.MKETY_AUTH_PROVIDER !== 'zitadel') {
    throw new Error(`Unsupported Mkety Auth provider: ${env.MKETY_AUTH_PROVIDER}`);
  }

  return createZitadelAdapter({
    issuer: env.MKETY_AUTH_ISSUER,
    clientId: env.MKETY_AUTH_CLIENT_ID,
    clientSecret: env.MKETY_AUTH_CLIENT_SECRET,
    redirectUri: env.MKETY_AUTH_REDIRECT_URI,
    postLogoutRedirectUri: env.MKETY_AUTH_POST_LOGOUT_REDIRECT_URI,
  });
}
