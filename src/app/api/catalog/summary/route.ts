import { NextResponse } from 'next/server';
import { getCatalogSummary } from '@/lib/JatuneCatalog';
import { getCorsHeaders } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return NextResponse.json(
    { ok: true, summary: getCatalogSummary() },
    { status: 200, headers: getCorsHeaders(request) }
  );
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getCorsHeaders(request) });
}
