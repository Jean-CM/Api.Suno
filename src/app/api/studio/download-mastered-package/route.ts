import { NextRequest, NextResponse } from 'next/server';
import { getCatalogRows } from '@/lib/JatuneCatalog';
import { buildZip, safeFileName } from '@/lib/JatuneZip';
import { getMasterPreset, masterAudioFromUrl } from '@/lib/JatuneMastering';
import { getCorsHeaders, requireApiKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const normalizeType = (value?: string | null) => {
  if (!value || value === 'Todos') return null;
  const clean = value.trim().toUpperCase();
  if (clean === 'ALBUM' || clean === 'ÁLBUM') return 'Álbum';
  if (clean === 'EP') return 'EP';
  if (clean === 'SENCILLO' || clean === 'SINGLE') return 'Sencillo';
  return value;
};

const buildRows = (albumId: number | null, tipoRaw: string | null) => {
  const tipo = normalizeType(tipoRaw);
  return getCatalogRows().filter((row) => {
    const byAlbum = albumId ? row.album_id === albumId : true;
    const byType = tipo ? row.tipo === tipo : true;
    return byAlbum && byType && Boolean(row.audio_url);
  });
};

const buildManifest = (items: Array<Record<string, any>>) => {
  return Buffer.from(JSON.stringify({ generated_at: new Date().toISOString(), items }, null, 2), 'utf-8');
};

export async function POST(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const albumId = body?.album_id ? Number(body.album_id) : null;
    const tipo = body?.tipo || null;
    const presetKey = body?.preset || 'streaming_ready';
    const preset = getMasterPreset(presetKey);
    const rows = buildRows(albumId, tipo).slice(0, Number(process.env.JATUNE_MASTER_MAX_TRACKS || 12));

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, code: 'NO_AUDIO_FOUND', message: 'No hay audios disponibles para masterizar con ese filtro.' },
        { status: 404, headers: getCorsHeaders(request) }
      );
    }

    const files: Array<{ name: string; data: Buffer }> = [];
    const manifest: Array<Record<string, any>> = [];
    const errors: Array<Record<string, any>> = [];

    for (const [index, row] of rows.entries()) {
      try {
        const trackNumber = String(index + 1).padStart(2, '0');
        const baseName = `${trackNumber} - ${safeFileName(row.artista)} - ${safeFileName(row.cancion)}`;
        const mastered = await masterAudioFromUrl(row.audio_url as string, { title: baseName, preset: preset.key });
        files.push({ name: `mastered/${baseName} - ${preset.name}.mp3`, data: mastered.output });
        manifest.push({
          track_id: row.cancion_id,
          artist: row.artista,
          project: row.album,
          title: row.cancion,
          preset: mastered.preset.name,
          loudness_target: mastered.preset.loudnessTarget,
          true_peak: mastered.preset.truePeak,
          format: 'MP3 320 kbps',
        });
      } catch (error: any) {
        errors.push({ track_id: row.cancion_id, title: row.cancion, error: error?.message || 'No fue posible masterizar.' });
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { ok: false, code: 'NO_MASTERED_AUDIO', message: 'No se pudo masterizar ningún audio.', errors },
        { status: 502, headers: getCorsHeaders(request) }
      );
    }

    files.push({ name: 'metadata/mastering-manifest.json', data: buildManifest(manifest) });
    if (errors.length > 0) files.push({ name: 'metadata/mastering-errors.json', data: buildManifest(errors) });

    const projectName = rows[0]?.album ? safeFileName(rows[0].album) : 'jatune-mastered';
    const zip = buildZip(files);
    const corsHeaders = getCorsHeaders(request);

    return new NextResponse(zip, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${projectName}-mastered-${preset.key}.zip"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, code: 'MASTERED_PACKAGE_FAILED', message: error?.message || 'No fue posible crear paquete masterizado.' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getCorsHeaders(request) });
}
