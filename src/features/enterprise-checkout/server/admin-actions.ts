'use server';

import { revalidatePath } from 'next/cache';

import { enterpriseCheckoutService } from '@/features/enterprise-checkout/server/service';
import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';

export interface EnterprisePaymentLinkInput {
  fullName: string;
  companyName: string;
  email: string;
  phone?: string;
  country?: string;
  scopeId?: string;
  projectName: string;
  projectDescription?: string;
  amount: string;
  provider: 'nowpayments' | 'selar';
  installmentLabel?: string;
}

export interface EnterprisePaymentLinkResult {
  ok: true;
  orderId: string;
  provider: 'nowpayments' | 'selar';
  redirectUrl: string;
  status: 'checkout_created' | 'awaiting_confirmation';
}

export async function createEnterprisePaymentLink(
  tenantSlug: string,
  input: EnterprisePaymentLinkInput,
): Promise<EnterprisePaymentLinkResult> {
  await requirePlatformControlAccess(tenantSlug);

  const installmentLabel = input.installmentLabel?.trim();
  const projectDescription = [
    input.projectDescription?.trim(),
    installmentLabel ? `Payment schedule: ${installmentLabel}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const result = await enterpriseCheckoutService.createEnterpriseCheckout(
    {
      fullName: input.fullName,
      companyName: input.companyName,
      email: input.email,
      phone: input.phone,
      country: input.country,
      scopeId: input.scopeId || 'enterprise',
      projectName: input.projectName,
      projectDescription,
      amount: input.amount,
      currency: 'USD',
      provider: input.provider,
    },
    { idempotencyKey: `admin-${crypto.randomUUID()}` },
  );

  revalidatePath(`/t/${tenantSlug}/admin/platform-control/enterprise-payments`);

  return { ok: true, ...result };
}
