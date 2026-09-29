import { NextResponse } from 'next/server';

import { quoteDomainRegistration } from '@/features/domains/server/service';
import { requireTenantAdmin } from '@/shared/lib/rbac';

interface RouteContext {
  params: Promise<{ tenant: string }>;
}

function money(value: bigint | null | undefined) {
  return value == null ? null : value.toString();
}

export async function GET(request: Request, { params }: RouteContext) {
  const { tenant } = await params;
  const session = await requireTenantAdmin(tenant);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const domain = String(url.searchParams.get('domain') ?? '').trim();
  const years = Number(url.searchParams.get('years') ?? 1);
  if (!domain) {
    return NextResponse.json({ success: false, error: 'Enter a domain to search.' }, { status: 400 });
  }

  try {
    const quote = await quoteDomainRegistration(domain, years);
    return NextResponse.json({
      success: true,
      data: {
        domain: quote.domain,
        available: quote.available,
        currency: quote.currency,
        registrationPriceMinor: money(quote.registrationPriceMinor),
        renewalPriceMinor: money(quote.renewalPriceMinor),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Mkety could not check this domain.',
      },
      { status: 400 },
    );
  }
}
