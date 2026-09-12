jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

jest.mock('@/features/platform-content/server/authorization', () => ({
  requirePlatformControlAccess: jest.fn(),
}));

jest.mock('@/features/enterprise-checkout/server/service', () => ({
  enterpriseCheckoutService: {
    createEnterpriseCheckout: jest.fn(),
  },
}));

import { enterpriseCheckoutService } from '@/features/enterprise-checkout/server/service';
import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';

import { createEnterprisePaymentLink } from './admin-actions';

const mockedRequireAccess = requirePlatformControlAccess as jest.MockedFunction<typeof requirePlatformControlAccess>;
const mockedCreateCheckout = enterpriseCheckoutService.createEnterpriseCheckout as jest.MockedFunction<
  typeof enterpriseCheckoutService.createEnterpriseCheckout
>;

describe('admin-issued Enterprise payment links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires Platform Control access and creates the exact negotiated installment through the selected provider', async () => {
    mockedRequireAccess.mockResolvedValue({ userId: 'admin-1', email: 'admin@mkety.com' } as never);
    mockedCreateCheckout.mockResolvedValue({
      orderId: 'MKETY-ENT-1',
      provider: 'nowpayments',
      redirectUrl: 'https://invoice.example/enterprise-1',
      status: 'checkout_created',
    });

    const result = await createEnterprisePaymentLink('mkety', {
      fullName: 'Enterprise Customer',
      companyName: 'Customer Ltd',
      email: 'buyer@example.com',
      scopeId: 'trading',
      projectName: 'Trading Infrastructure',
      projectDescription: 'Agreed implementation scope.',
      amount: '2500.00',
      provider: 'nowpayments',
      installmentLabel: '50% deposit',
    });

    expect(mockedRequireAccess).toHaveBeenCalledWith('mkety');
    expect(mockedCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '2500.00',
        currency: 'USD',
        provider: 'nowpayments',
        scopeId: 'trading',
        projectName: 'Trading Infrastructure',
        projectDescription: 'Agreed implementation scope.\n\nPayment schedule: 50% deposit',
      }),
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^admin-/) }),
    );
    expect(result).toEqual(expect.objectContaining({ ok: true, orderId: 'MKETY-ENT-1', provider: 'nowpayments' }));
  });

  it('does not create a checkout when admin authorization fails', async () => {
    mockedRequireAccess.mockRejectedValue(new Error('Forbidden'));

    await expect(
      createEnterprisePaymentLink('mkety', {
        fullName: 'Enterprise Customer',
        companyName: 'Customer Ltd',
        email: 'buyer@example.com',
        projectName: 'Custom Project',
        amount: '1000.00',
        provider: 'selar',
      }),
    ).rejects.toThrow('Forbidden');

    expect(mockedCreateCheckout).not.toHaveBeenCalled();
  });
});
