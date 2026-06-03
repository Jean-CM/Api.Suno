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

const buildRows = (albumId: number | null, tipoRaw: string | null, artistRaw: string | null) => {
  const tipo = normalizeType(tipoRaw);
  const artist = artistRaw && artistRaw !== 'Todos' ? artistRaw.trim().toLowerCase() : null;

  return getCatalogRows().filter((row) => {
    const byAlbum = albumId ? row.album_id === albumId : true;
    const byType = tipo ? row.tipo === tipo : true;
    const byArtist = artist ? row.artista.trim().toLowerCase() === artist : true;
    return byAlbum && byType && byArtist && Boolean(row.audio_url);
  });
};

export async function POST(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const albumId = body?.album_id ? Number(body.album_id) : null;
    const tipo = body?.tipo || null;
    const artist = body?.artist || null;
    const presetKey = body?.preset || 'streaming_ready';
    const preset = getMasterPreset(presetKey);
    const rows = buildRows(albumId, tipo, artist).slice(0, Number(process.env.JATUNE_MASTER_MAX_TRACKS || 12));

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, code: 'NO_AUDIO_FOUND', message: 'No hay audios disponibles para masterizar con ese filtro.' },
        { status: 404, headers: getCorsHeaders(request) }
      );
    }

    const files: Array<{ name: string; data: Buffer }> = [];
    const errors: Array<Record<string, any>> = [];

    for (const [index, row] of rows.entries()) {
      try {
        const trackNumber = String(index + 1).padStart(2, '0');
        const baseName = `${trackNumber} - ${safeFileName(row.artista)} - ${safeFileName(row.cancion)}`;
        const mastered = await masterAudioFromUrl(row.audio_url as string, { title: baseName, preset: preset.key });
        files.push({ name: `${baseName} - ${preset.name}.mp3`, data: mastered.output });
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

    const projectName = albumId
      ? safeFileName(rows[0]?.album || 'jatune-mastered')
      : artist
        ? safeFileName(artist)
        : rows[0]?.album
          ? safeFileName(rows[0].album)
          : 'jatune-mastered';

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
