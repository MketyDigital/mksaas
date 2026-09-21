import { withRequestDatabase } from '@/shared/db/request';
import { env } from '@/shared/lib/env';

import { generateOpaqueToken, isSafeReturnTo } from './crypto';
import { createPkcePair } from './oidc';
import { getIdentityProvider } from './providers';
import {
  consumeLoginTransaction,
  createExternalIdentity,
  createLoginTransaction,
  createSession,
  createUser,
  findUserByEmail,
  findUserByExternalIdentity,
  revokeSession,
} from './repository';

export const MKETY_SESSION_COOKIE = 'mkety_session';
export const MKETY_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const MKETY_LOGIN_TRANSACTION_TTL_SECONDS = 10 * 60;

export type AuthIntent = 'signin' | 'signup';

export async function beginLogin(returnTo = '/select-tenant', intent: AuthIntent = 'signin'): Promise<string> {
  const safeReturnTo = isSafeReturnTo(returnTo) ? returnTo : '/select-tenant';
  const provider = getIdentityProvider();
  const state = generateOpaqueToken();
  const nonce = generateOpaqueToken();
  const pkce = await createPkcePair();

  await withRequestDatabase((database) =>
    createLoginTransaction(
      {
        state,
        provider: env.MKETY_AUTH_PROVIDER,
        verifier: pkce.verifier,
        nonce,
        returnTo: safeReturnTo,
        expiresAt: new Date(Date.now() + MKETY_LOGIN_TRANSACTION_TTL_SECONDS * 1000),
      },
      database,
    ),
  );

  return provider.createAuthorizationUrl({
    state,
    nonce,
    codeChallenge: pkce.challenge,
    redirectUri: env.MKETY_AUTH_REDIRECT_URI,
    returnTo: safeReturnTo,
    prompt: intent === 'signup' ? 'create' : 'login',
  });
}

export async function completeLogin(code: string, state: string) {
  if (!code || !state) throw new Error('Authentication callback is incomplete');

  const transaction = await withRequestDatabase((database) => consumeLoginTransaction(state, database));
  if (!transaction) throw new Error('Authentication callback state is invalid or expired');
  if (transaction.provider !== env.MKETY_AUTH_PROVIDER) throw new Error('Authentication provider changed during login');

  const provider = getIdentityProvider();
  const identity = await provider.exchangeCode({
    code,
    verifier: transaction.verifier,
    nonce: transaction.nonce,
    redirectUri: env.MKETY_AUTH_REDIRECT_URI,
  });

  return withRequestDatabase(async (database) => {
    let user = await findUserByExternalIdentity(identity.provider, identity.subject, database);

    if (!user && identity.email && identity.emailVerified) {
      user = await findUserByEmail(identity.email, database);
    }

    if (!user) {
      user = await createUser(
        {
          email: identity.emailVerified ? identity.email : null,
          name: identity.name,
          image: identity.image,
        },
        database,
      );
    }

    await createExternalIdentity(
      {
        provider: identity.provider,
        subject: identity.subject,
        userId: user.id,
        email: identity.emailVerified ? identity.email : null,
        name: identity.name,
        image: identity.image,
      },
      database,
    );

    const expiresAt = new Date(Date.now() + MKETY_SESSION_MAX_AGE_SECONDS * 1000);
    const session = await createSession(user.id, expiresAt, database);

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      redirectTo: transaction.returnTo,
    };
  });
}

export async function logoutSession(token: string | null | undefined, returnTo = '/login') {
  const safeReturnTo = isSafeReturnTo(returnTo) ? returnTo : '/login';
  if (token) {
    await withRequestDatabase((database) => revokeSession(token, database));
  }

  try {
    const provider = getIdentityProvider();
    const providerLogoutUrl = await provider.getLogoutUrl({
      postLogoutRedirectUri: env.MKETY_AUTH_POST_LOGOUT_REDIRECT_URI,
    });
    if (providerLogoutUrl) return providerLogoutUrl;
  } catch {
    // Local Mkety logout has already completed. Provider logout is best-effort.
  }

  return safeReturnTo;
}
