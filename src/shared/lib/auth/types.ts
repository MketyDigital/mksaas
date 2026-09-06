import type { TenantRole } from '@/shared/db/schema/auth';

export interface MketySessionUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  roles: Record<string, TenantRole>;
  permissions: Record<string, string[]>;
}

export interface MketySession {
  user: MketySessionUser;
  expiresAt: Date;
}

export interface ExternalIdentity {
  provider: string;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
}

export interface AuthorizationRequest {
  state: string;
  codeChallenge: string;
  nonce: string;
  redirectUri: string;
  returnTo: string;
}

export interface AuthorizationCodeExchange {
  code: string;
  verifier: string;
  nonce: string;
  redirectUri: string;
}

export interface ProviderLogoutRequest {
  idTokenHint?: string;
  postLogoutRedirectUri: string;
}

export interface IdentityProviderAdapter {
  createAuthorizationUrl(input: AuthorizationRequest): Promise<string>;
  exchangeCode(input: AuthorizationCodeExchange): Promise<ExternalIdentity>;
  getLogoutUrl(input: ProviderLogoutRequest): Promise<string | null>;
}
