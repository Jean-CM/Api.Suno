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

const buildRows = (
  albumId: number | null,
  tipoRaw: string | null,
  artistRaw: string | null
) => {
  const tipo = normalizeType(tipoRaw);
  const artist =
    artistRaw && artistRaw !== 'Todos'
      ? artistRaw.trim().toLowerCase()
      : null;

  return getCatalogRows().filter((row) => {
    const byAlbum = albumId ? row.album_id === albumId : true;
    const byType = tipo ? row.tipo === tipo : true;
    const byArtist = artist
      ? row.artista.trim().toLowerCase() === artist
      : true;

    return byAlbum && byType && byArtist && Boolean(row.audio_url);
  });
};

const makeFolderName = (rows: any[], tipo?: string | null) => {
  const projects = Array.from(
    new Set(rows.map((row) => row.album).filter(Boolean))
  );

  const artists = Array.from(
    new Set(rows.map((row) => row.artista).filter(Boolean))
  );

  const projectName =
    projects.length === 1
      ? String(projects[0])
      : tipo && tipo !== 'Todos'
        ? `${tipo} Masterizados`
        : 'JATune Masters';

  const artistName =
    artists.length === 1
      ? String(artists[0])
      : 'Varios Artistas';

  return safeFileName(`${projectName} - ${artistName}`, 'jatune-mastered');
};

const makeSongFileName = (title: string, usedNames: Set<string>) => {
  const base = safeFileName(title, 'cancion');
  let fileName = `${base}.mp3`;
  let index = 2;

  while (usedNames.has(fileName.toLowerCase())) {
    fileName = `${base} ${index}.mp3`;
    index += 1;
  }

  usedNames.add(fileName.toLowerCase());
  return fileName;
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

    const rows = buildRows(albumId, tipo, artist).slice(
      0,
      Number(process.env.JATUNE_MASTER_MAX_TRACKS || 12)
    );

    if (rows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          code: 'NO_AUDIO_FOUND',
          message: 'No hay audios disponibles para masterizar con ese filtro.',
        },
        {
          status: 404,
          headers: getCorsHeaders(request),
        }
      );
    }

    const folderName = makeFolderName(rows, tipo);
    const files: Array<{ name: string; data: Buffer }> = [];
    const errors: Array<Record<string, any>> = [];
    const usedNames = new Set<string>();

    for (const row of rows) {
      try {
        const sourceName = `${safeFileName(row.artista)} - ${safeFileName(
          row.cancion
        )}`;

        const mastered = await masterAudioFromUrl(row.audio_url as string, {
          title: sourceName,
          preset: preset.key,
        });

        const songFileName = makeSongFileName(row.cancion, usedNames);

        files.push({
          name: `${folderName}/${songFileName}`,
          data: mastered.output,
        });
      } catch (error: any) {
        errors.push({
          track_id: row.cancion_id,
          title: row.cancion,
          error: error?.message || 'No fue posible masterizar.',
        });
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          code: 'NO_MASTERED_AUDIO',
          message: 'No se pudo masterizar ningún audio.',
          errors,
        },
        {
          status: 502,
          headers: getCorsHeaders(request),
        }
      );
    }

    const zip = buildZip(files);
    const corsHeaders = getCorsHeaders(request);

    return new NextResponse(zip, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${folderName}-mastered-${preset.key}.zip"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        code: 'MASTERED_PACKAGE_FAILED',
        message:
          error?.message || 'No fue posible crear paquete masterizado.',
      },
      {
        status: 500,
        headers: getCorsHeaders(request),
      }
    );
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(request),
  });
}
