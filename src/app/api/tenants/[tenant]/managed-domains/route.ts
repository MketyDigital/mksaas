import { NextResponse } from 'next/server';

import {
  listManagedDomains,
  provisionManagedDomainDns,
  setManagedDomainAutoRenew,
} from '@/features/domains/server/managed-domain-service';

interface RouteContext {
  params: Promise<{ tenant: string }>;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Mkety Domains request failed.';
  const status = /unauthorized/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 400;
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { tenant } = await params;
  try {
    return NextResponse.json({ success: true, data: await listManagedDomains(tenant) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const { tenant } = await params;
  const body = (await request.json().catch(() => ({}))) as { id?: string; action?: string };
  if (!body.id || body.action !== 'provision-dns') {
    return NextResponse.json({ success: false, error: 'Valid managed domain action is required.' }, { status: 400 });
  }
  try {
    const data = await provisionManagedDomainDns(tenant, body.id);
    return NextResponse.json({ success: true, data, message: 'Mkety DNS provisioning completed.' });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { tenant } = await params;
  const body = (await request.json().catch(() => ({}))) as { id?: string; autoRenew?: boolean };
  if (!body.id || typeof body.autoRenew !== 'boolean') {
    return NextResponse.json({ success: false, error: 'Domain ID and autoRenew are required.' }, { status: 400 });
  }
  try {
    const data = await setManagedDomainAutoRenew(tenant, body.id, body.autoRenew);
    return NextResponse.json({ success: true, data, message: 'Renewal preference updated.' });
  } catch (error) {
    return errorResponse(error);
  }
}
