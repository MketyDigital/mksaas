import { readCustomerCandidateRuntimeConfig } from './customer-candidate-runtime';

describe('customer Deploy candidate runtime config', () => {
  it('requires dedicated Deploy Cloudflare credentials', () => {
    expect(() => readCustomerCandidateRuntimeConfig({})).toThrow(
      'Mkety Deploy candidate provider is not configured.',
    );
    expect(() =>
      readCustomerCandidateRuntimeConfig({
        MKETY_DEPLOY_CLOUDFLARE_ACCOUNT_ID: 'account-1',
      }),
    ).toThrow('Mkety Deploy candidate provider is not configured.');
  });

  it('accepts only the dedicated server-side credential contract', () => {
    expect(
      readCustomerCandidateRuntimeConfig({
        MKETY_DEPLOY_CLOUDFLARE_ACCOUNT_ID: ' account-1 ',
        MKETY_DEPLOY_CLOUDFLARE_API_TOKEN: ' secret-token ',
      }),
    ).toEqual({
      accountId: 'account-1',
      apiToken: 'secret-token',
    });
  });
});
