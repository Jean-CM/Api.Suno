import { NextRequest, NextResponse } from 'next/server';
import { buildSunoPromptFromCatalogRow, getNextPendingTracks, updateTrackStatus } from '@/lib/JatuneCatalog';
import { DEFAULT_MODEL, sunoApi } from '@/lib/SunoApi';
import { getCorsHeaders, requireApiKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const firstClip = (response: any) => {
  if (Array.isArray(response) && response.length > 0) return response[0];
  if (response?.clips && Array.isArray(response.clips) && response.clips.length > 0) return response.clips[0];
  if (response?.tracks && Array.isArray(response.tracks) && response.tracks.length > 0) return response.tracks[0];
  return response || {};
};

export async function POST(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(Number(body?.limit || 1), 3));
    const waitAudio = Boolean(body?.wait_audio ?? false);
    const makeInstrumental = Boolean(body?.make_instrumental ?? false);

    const pending = getNextPendingTracks(limit);
    const results = [];

    for (const row of pending) {
      try {
        updateTrackStatus(row.cancion_id, { estado: 'Generando', error_detalle: undefined });
        const prompt = buildSunoPromptFromCatalogRow(row);
        const api = await sunoApi();
        const generated = await api.generate(prompt, makeInstrumental, body?.model || DEFAULT_MODEL, waitAudio);
        const clip = firstClip(generated);

        const status = clip?.audio_url ? 'Completada' : 'Generando';
        updateTrackStatus(row.cancion_id, {
          estado: status,
          clip_id: clip?.id,
          audio_url: clip?.audio_url,
          image_url: clip?.image_url,
          video_url: clip?.video_url,
          error_detalle: undefined,
        });

        results.push({ ok: true, track_id: row.cancion_id, title: row.cancion, status, clip });
      } catch (error: any) {
        updateTrackStatus(row.cancion_id, { estado: 'Error', error_detalle: error?.message || 'Error generando canción.' });
        results.push({ ok: false, track_id: row.cancion_id, title: row.cancion, error: error?.message || 'Error generando canción.' });
      }
    }

    return NextResponse.json(
      { ok: true, processed: results.length, results },
      { status: 200, headers: getCorsHeaders(request) }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, code: 'GENERATE_PENDING_ERROR', message: error?.message || 'Error procesando pendientes.' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getCorsHeaders(request) });
}
