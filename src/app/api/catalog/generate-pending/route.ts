import { NextRequest, NextResponse } from 'next/server';
import { buildSunoPromptFromCatalogRow, getNextPendingTracks, updateTrackStatus } from '@/lib/JatuneCatalog';
import { DEFAULT_MODEL, sunoApi } from '@/lib/SunoApi';
import { getCorsHeaders, requireApiKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const SELECTION_POLICY = 'smallest_file_then_shortest_duration';

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

const getClipSize = (clip: any): number | null => {
  const candidates = [
    clip?.file_size,
    clip?.fileSize,
    clip?.size,
    clip?.audio_size,
    clip?.audioSize,
    clip?.metadata?.file_size,
    clip?.metadata?.fileSize,
    clip?.metadata?.audio_size,
    clip?.metadata?.audioSize,
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

  const withSize = candidates
    .map((clip) => ({ clip, size: getClipSize(clip), duration: getClipDuration(clip) }))
    .filter((item) => item.size !== null) as Array<{ clip: any; size: number; duration: number | null }>;

  if (withSize.length > 0) {
    withSize.sort((a, b) => a.size - b.size || (a.duration || 99999) - (b.duration || 99999));
    return withSize[0].clip;
  }

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
    // Suno suele entregar 2 audios por canción. 5 pendientes = hasta 10 audios, controlado y estable.
    const limit = Math.max(1, Math.min(Number(body?.limit || 5), 5));
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
        const clips = getClips(generated);
        const clip = selectBestClip(generated);
        const selectedDuration = getClipDuration(clip);
        const selectedSize = getClipSize(clip);

        const status = clip?.audio_url ? 'Completada' : 'Generando';
        updateTrackStatus(row.cancion_id, {
          estado: status,
          clip_id: clip?.id,
          audio_url: clip?.audio_url,
          image_url: clip?.image_url,
          video_url: clip?.video_url,
          duration: selectedDuration || undefined,
          versions_received: clips.length,
          selected_version_policy: SELECTION_POLICY,
          error_detalle: undefined,
        });

        results.push({
          ok: true,
          track_id: row.cancion_id,
          title: row.cancion,
          status,
          selected_policy: SELECTION_POLICY,
          selected_duration: selectedDuration,
          selected_size: selectedSize,
          versions_received: clips.length,
          clip,
        });
      } catch (error: any) {
        updateTrackStatus(row.cancion_id, { estado: 'Error', error_detalle: error?.message || 'Error generando canción.' });
        results.push({ ok: false, track_id: row.cancion_id, title: row.cancion, error: error?.message || 'Error generando canción.' });
      }
    }

    return NextResponse.json(
      { ok: true, processed: results.length, selection_policy: SELECTION_POLICY, results },
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
