import type { IdentityProviderAdapter } from '../types';

export interface ZitadelAdapterConfig {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
}

export type { IdentityProviderAdapter };
