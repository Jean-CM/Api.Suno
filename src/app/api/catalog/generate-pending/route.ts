import { NextRequest, NextResponse } from 'next/server';
import { buildSunoPromptFromCatalogRow, getNextPendingTracks, updateTrackStatus } from '@/lib/JatuneCatalog';
import { DEFAULT_MODEL, sunoApi } from '@/lib/SunoApi';
import { getCorsHeaders, requireApiKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const SELECTION_POLICY = 'smallest_file_then_shortest_duration';
const DEFAULT_BATCH_LIMIT = Number(process.env.JATUNE_AUTO_GENERATE_LIMIT || 10);
const DEFAULT_DELAY_MS = Number(process.env.JATUNE_AUTO_GENERATE_DELAY_MS || 55000);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

const normalizeGenerationError = (error: any) => {
  const message = error?.message || 'Error generando canción.';

  if (message.includes('No hCaptcha request occurred')) {
    return 'Suno no disparó la validación hCaptcha en 1 minuto. Se detuvo la tanda para evitar más errores. Valida la sesión en Suno y vuelve a intentar.';
  }

  if (message.includes('token_validation_failed') || message.includes("couldn't verify your request")) {
    return 'Suno rechazó la validación de la sesión. Actualiza SUNO_COOKIE o valida manualmente la cuenta en Suno.';
  }

  if (message.includes('chromium_headless_shell') || message.includes('<launching>')) {
    return 'El navegador interno tardó demasiado abriendo Suno. Se detuvo la tanda para proteger el servidor.';
  }

  return message.length > 600 ? `${message.slice(0, 600)}...` : message;
};

const shouldStopBatch = (message: string) => {
  return message.includes('hCaptcha') || message.includes('validación') || message.includes('SUNO_COOKIE') || message.includes('navegador interno');
};

export async function POST(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const rawLimit = Number(body?.limit || DEFAULT_BATCH_LIMIT);
    const requestedLimit = body?.single === true ? 1 : rawLimit <= 1 ? DEFAULT_BATCH_LIMIT : rawLimit;
    const limit = Math.max(1, Math.min(requestedLimit, 10));
    const delayMs = Math.max(0, Math.min(Number(body?.delay_ms || DEFAULT_DELAY_MS), 90000));
    const waitAudio = Boolean(body?.wait_audio ?? false);
    const makeInstrumental = Boolean(body?.make_instrumental ?? false);

    const pending = getNextPendingTracks(limit);
    const results = [];

    for (const [index, row] of pending.entries()) {
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

        if (index < pending.length - 1 && delayMs > 0) {
          await sleep(delayMs);
        }
      } catch (error: any) {
        const message = normalizeGenerationError(error);
        updateTrackStatus(row.cancion_id, { estado: 'Error', error_detalle: message });
        results.push({ ok: false, track_id: row.cancion_id, title: row.cancion, error: message });

        if (shouldStopBatch(message)) break;
      }
    }

    return NextResponse.json(
      { ok: true, processed: results.length, requested: pending.length, delay_ms: delayMs, selection_policy: SELECTION_POLICY, results },
      { status: 200, headers: getCorsHeaders(request) }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, code: 'GENERATE_PENDING_ERROR', message: normalizeGenerationError(error) },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getCorsHeaders(request) });
}
