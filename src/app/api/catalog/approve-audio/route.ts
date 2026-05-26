import { NextRequest, NextResponse } from 'next/server';
import { approveTrackAudio } from '@/lib/JatuneCatalog';
import { getCorsHeaders, requireApiKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const trackId = Number(body?.track_id);

    if (!trackId) {
      return NextResponse.json(
        { ok: false, code: 'TRACK_ID_REQUIRED', message: 'Debes enviar track_id.' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    const track = approveTrackAudio(trackId);

    return NextResponse.json(
      { ok: true, track },
      { status: 200, headers: getCorsHeaders(request) }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, code: 'APPROVE_AUDIO_FAILED', message: error?.message || 'No fue posible aprobar el audio.' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getCorsHeaders(request) });
}
