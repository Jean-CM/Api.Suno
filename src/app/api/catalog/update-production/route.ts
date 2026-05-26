import { NextRequest, NextResponse } from 'next/server';
import { updateTrackStatus } from '@/lib/JatuneCatalog';
import { getCorsHeaders, requireApiKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const allowedFields = new Set([
  'audio_final_status',
  'master_status',
  'cover_status',
  'metadata_status',
  'distribution_status',
  'genre',
  'subgenre',
  'language',
  'isrc',
  'release_date',
  'credits',
  'description_short',
  'description_long',
  'cover_url',
  'cover_prompt',
  'visual_prompt_cover',
  'visual_prompt_canvas',
  'visual_prompt_short_video',
  'visual_prompt_lyric_video',
  'notas_internas',
]);

export async function POST(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const trackId = Number(body?.track_id);
    const updates = body?.updates || {};

    if (!trackId) {
      return NextResponse.json(
        { ok: false, code: 'TRACK_ID_REQUIRED', message: 'Debes enviar track_id.' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    const safeUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.has(key)) safeUpdates[key] = value;
    }

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json(
        { ok: false, code: 'NO_VALID_FIELDS', message: 'No enviaste campos válidos para actualizar producción.' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    const track = updateTrackStatus(trackId, safeUpdates as any);

    return NextResponse.json(
      { ok: true, track },
      { status: 200, headers: getCorsHeaders(request) }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, code: 'UPDATE_PRODUCTION_FAILED', message: error?.message || 'No fue posible actualizar la producción.' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getCorsHeaders(request) });
}
