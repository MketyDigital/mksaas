import { NextResponse } from 'next/server';

import { auth } from '@/shared/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  return NextResponse.json(session, {
    headers: {
      'Cache-Control': 'private, no-store',
    },
  });
}
