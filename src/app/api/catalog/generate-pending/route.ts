import { NextRequest, NextResponse } from 'next/server';
import { buildSunoPromptFromCatalogRow, getNextPendingTracks, updateTrackStatus } from '@/lib/JatuneCatalog';
import { DEFAULT_MODEL, sunoApi } from '@/lib/SunoApi';
import { getCorsHeaders, requireApiKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const getClipDuration = (clip: any): number | null => {
  const candidates = [
    clip?.duration,
    clip?.duration_seconds,
    clip?.durationSeconds,
    clip?.metadata?.duration,
    clip?.metadata?.duration_seconds,
    clip?.metadata?.durationSeconds,
    clip?.audio_duration,
    clip?.audioDuration,
  ];

  for (const value of candidates) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }

  return null;
};

const getClips = (response: any): any[] => {
  if (Array.isArray(response)) return response.filter(Boolean);
  if (Array.isArray(response?.clips)) return response.clips.filter(Boolean);
  if (Array.isArray(response?.tracks)) return response.tracks.filter(Boolean);
  if (response && typeof response === 'object') return [response];
  return [];
};

const selectBestClip = (response: any) => {
  const clips = getClips(response);
  if (clips.length === 0) return {};

  const withAudio = clips.filter((clip) => Boolean(clip?.audio_url));
  const candidates = withAudio.length > 0 ? withAudio : clips;

  const withDuration = candidates
    .map((clip) => ({ clip, duration: getClipDuration(clip) }))
    .filter((item) => item.duration !== null) as Array<{ clip: any; duration: number }>;

  if (withDuration.length > 0) {
    withDuration.sort((a, b) => a.duration - b.duration);
    return withDuration[0].clip;
  }

  return candidates[0];
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
        const clip = selectBestClip(generated);
        const selectedDuration = getClipDuration(clip);
        const totalVersions = getClips(generated).length;

        const status = clip?.audio_url ? 'Completada' : 'Generando';
        updateTrackStatus(row.cancion_id, {
          estado: status,
          clip_id: clip?.id,
          audio_url: clip?.audio_url,
          image_url: clip?.image_url,
          video_url: clip?.video_url,
          error_detalle: undefined,
        });

        results.push({
          ok: true,
          track_id: row.cancion_id,
          title: row.cancion,
          status,
          selected_policy: 'shortest_duration_available',
          selected_duration: selectedDuration,
          versions_received: totalVersions,
          clip,
        });
      } catch (error: any) {
        updateTrackStatus(row.cancion_id, { estado: 'Error', error_detalle: error?.message || 'Error generando canción.' });
        results.push({ ok: false, track_id: row.cancion_id, title: row.cancion, error: error?.message || 'Error generando canción.' });
      }
    }

    return NextResponse.json(
      { ok: true, processed: results.length, selection_policy: 'shortest_duration_available', results },
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
