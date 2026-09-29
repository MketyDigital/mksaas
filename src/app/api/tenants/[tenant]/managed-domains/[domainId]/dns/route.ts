import { NextResponse } from 'next/server';

import {
  listManagedDnsRecords,
  removeManagedDnsRecord,
  saveManagedDnsRecord,
} from '@/features/domains/server/managed-domain-service';

interface RouteContext {
  params: Promise<{ tenant: string; domainId: string }>;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Mkety DNS request failed.';
  const status = /unauthorized/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 400;
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { tenant, domainId } = await params;
  try {
    return NextResponse.json({ success: true, data: await listManagedDnsRecords(tenant, domainId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const { tenant, domainId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    type?: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'SRV' | 'CAA';
    name?: string;
    content?: string;
    ttl?: number;
    proxied?: boolean;
    priority?: number;
  };
  if (!body.type || !body.name || !body.content) {
    return NextResponse.json({ success: false, error: 'Record type, name and content are required.' }, { status: 400 });
  }
  try {
    const data = await saveManagedDnsRecord(tenant, domainId, {
      type: body.type,
      name: body.name,
      content: body.content,
      ttl: body.ttl,
      proxied: body.proxied,
      priority: body.priority,
    });
    return NextResponse.json({ success: true, data, message: 'DNS record created.' });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { tenant, domainId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    type?: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'SRV' | 'CAA';
    name?: string;
    content?: string;
    ttl?: number;
    proxied?: boolean;
    priority?: number;
  };
  if (!body.id || !body.type || !body.name || !body.content) {
    return NextResponse.json({ success: false, error: 'Record ID, type, name and content are required.' }, { status: 400 });
  }
  try {
    const data = await saveManagedDnsRecord(tenant, domainId, {
      id: body.id,
      type: body.type,
      name: body.name,
      content: body.content,
      ttl: body.ttl,
      proxied: body.proxied,
      priority: body.priority,
    });
    return NextResponse.json({ success: true, data, message: 'DNS record updated.' });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { tenant, domainId } = await params;
  const body = (await request.json().catch(() => ({}))) as { recordId?: string };
  if (!body.recordId) {
    return NextResponse.json({ success: false, error: 'Record ID is required.' }, { status: 400 });
  }
  try {
    await removeManagedDnsRecord(tenant, domainId, body.recordId);
    return NextResponse.json({ success: true, data: null, message: 'DNS record removed.' });
  } catch (error) {
    return errorResponse(error);
  }
}
