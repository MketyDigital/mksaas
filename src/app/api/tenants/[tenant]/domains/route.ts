import { NextResponse } from 'next/server';

import { addDomain, listDomains, removeDomain, verifyDomain } from '@/features/admin/services/domains-service';

interface RouteContext {
  params: Promise<{ tenant: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { tenant } = await params;
  const result = await listDomains(tenant);
  return NextResponse.json(result, { status: result.success ? 200 : 403 });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { tenant } = await params;
  const body = (await request.json().catch(() => ({}))) as { hostname?: string };
  if (!body.hostname) return NextResponse.json({ success: false, error: 'hostname is required' }, { status: 400 });
  const result = await addDomain(tenant, body.hostname);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { tenant } = await params;
  const body = (await request.json().catch(() => ({}))) as { hostname?: string };
  if (!body.hostname) return NextResponse.json({ success: false, error: 'hostname is required' }, { status: 400 });
  const result = await verifyDomain(tenant, body.hostname);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { tenant } = await params;
  const body = (await request.json().catch(() => ({}))) as { hostname?: string };
  if (!body.hostname) return NextResponse.json({ success: false, error: 'hostname is required' }, { status: 400 });
  const result = await removeDomain(tenant, body.hostname);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
