import { NextRequest, NextResponse } from 'next/server';
import { getGeneratedTracksToRefresh, updateTrackStatus } from '@/lib/JatuneCatalog';
import { sunoApi } from '@/lib/SunoApi';
import { getCorsHeaders, requireApiKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const getClipDuration = (clip: any): string | number | undefined => {
  return clip?.duration || clip?.duration_seconds || clip?.metadata?.duration || clip?.metadata?.duration_seconds;
};

export async function POST(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const tracks = getGeneratedTracksToRefresh();
    const api = await sunoApi();
    const results = [];

    for (const track of tracks.slice(0, 10)) {
      try {
        if (!track.clip_id) continue;
        const response = await api.get([track.clip_id]);
        const clip = response?.[0];

        if (!clip) {
          results.push({ ok: false, track_id: track.cancion_id, title: track.cancion, error: 'Suno no devolvió información del clip.' });
          continue;
        }

        const isReady = Boolean(clip.audio_url) && (clip.status === 'streaming' || clip.status === 'complete');
        updateTrackStatus(track.cancion_id, {
          estado: isReady ? 'Completada' : 'Generando',
          audio_url: clip.audio_url || track.audio_url,
          image_url: clip.image_url || track.image_url,
          video_url: clip.video_url || track.video_url,
          duration: getClipDuration(clip) || track.duration,
          error_detalle: clip.error_message || undefined,
        });

        results.push({ ok: true, track_id: track.cancion_id, title: track.cancion, status: isReady ? 'Completada' : 'Generando', clip });
      } catch (error: any) {
        results.push({ ok: false, track_id: track.cancion_id, title: track.cancion, error: error?.message || 'Error refrescando clip.' });
      }
    }

    return NextResponse.json(
      { ok: true, checked: results.length, results },
      { status: 200, headers: getCorsHeaders(request) }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, code: 'REFRESH_GENERATED_FAILED', message: error?.message || 'No fue posible refrescar canciones generadas.' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getCorsHeaders(request) });
}
