import { NextRequest, NextResponse } from 'next/server';
import { MASTER_PRESETS } from '@/lib/JatuneMastering';
import { getCorsHeaders, requireApiKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  return NextResponse.json(
    { ok: true, presets: Object.values(MASTER_PRESETS) },
    { status: 200, headers: getCorsHeaders(request) }
  );
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getCorsHeaders(request) });
}
