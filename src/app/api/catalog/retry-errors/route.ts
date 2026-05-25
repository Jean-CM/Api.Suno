import { NextRequest, NextResponse } from 'next/server';
import { retryErrorTracks } from '@/lib/JatuneCatalog';
import { getCorsHeaders, requireApiKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const result = retryErrorTracks();
    return NextResponse.json(
      { ok: true, ...result },
      { status: 200, headers: getCorsHeaders(request) }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, code: 'RETRY_ERRORS_FAILED', message: error?.message || 'No fue posible marcar errores para reintento.' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getCorsHeaders(request) });
}
