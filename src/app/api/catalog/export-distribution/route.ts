import { NextRequest, NextResponse } from 'next/server';
import { getCatalogRows, getWorkspaceRows } from '@/lib/JatuneCatalog';
import { getCorsHeaders, requireApiKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const checklistForTrack = (track: any) => ({
  audio_revisado: track.audio_final_status === 'Aprobado',
  audio_masterizado: track.master_status === 'Masterizada',
  portada_lista: track.cover_status === 'Lista' || Boolean(track.cover_url),
  metadata_completa: track.metadata_status === 'Completa',
  isrc_asignado: Boolean(track.isrc),
  fecha_lanzamiento_definida: Boolean(track.release_date),
  creditos_revisados: Boolean(track.credits),
  descripcion_lista: Boolean(track.description_short || track.description_long),
  visual_preparado: Boolean(track.visual_prompt_canvas || track.visual_prompt_short_video || track.visual_prompt_lyric_video),
  listo_para_subir: track.audio_final_status === 'Aprobado' && track.metadata_status === 'Completa' && Boolean(track.cover_url || track.cover_prompt),
});

const normalizeType = (value?: string | null) => {
  if (!value || value === 'Todos') return null;
  const clean = value.trim().toUpperCase();
  if (clean === 'ALBUM' || clean === 'ÁLBUM') return 'Álbum';
  if (clean === 'EP') return 'EP';
  if (clean === 'SENCILLO' || clean === 'SINGLE') return 'Sencillo';
  return value;
};

const buildPackage = (params: { albumId?: number | null; tipo?: string | null }) => {
  const tipo = normalizeType(params.tipo || null);
  const rows = getCatalogRows().filter((row) => {
    const byAlbum = params.albumId ? row.album_id === params.albumId : true;
    const byType = tipo ? row.tipo === tipo : true;
    return byAlbum && byType;
  });

  const workspaces = getWorkspaceRows().filter((workspace) => {
    const byAlbum = params.albumId ? workspace.album_id === params.albumId : true;
    const byType = tipo ? workspace.tipo === tipo : true;
    return byAlbum && byType;
  });

  const tracks = rows.map((row) => ({
    track_id: row.cancion_id,
    titulo: row.cancion,
    artista: row.artista,
    proyecto: row.album,
    tipo: row.tipo,
    workspace_name: row.workspace_name,
    audio_url: row.audio_url,
    clip_id: row.clip_id,
    duration: row.duration,
    versions_received: row.versions_received,
    selected_version_policy: row.selected_version_policy,
    audio_final_status: row.audio_final_status,
    master_status: row.master_status,
    cover_status: row.cover_status,
    metadata_status: row.metadata_status,
    distribution_status: row.distribution_status,
    genero: row.genre,
    subgenero: row.subgenre,
    idioma: row.language,
    isrc: row.isrc,
    fecha_lanzamiento: row.release_date,
    creditos: row.credits,
    descripcion_corta: row.description_short,
    descripcion_larga: row.description_long,
    cover_url: row.cover_url || row.image_url,
    cover_prompt: row.cover_prompt,
    visual_prompt_cover: row.visual_prompt_cover,
    visual_prompt_canvas: row.visual_prompt_canvas,
    visual_prompt_short_video: row.visual_prompt_short_video,
    visual_prompt_lyric_video: row.visual_prompt_lyric_video,
    checklist: checklistForTrack(row),
    assets: {
      audio: row.audio_url,
      cover: row.cover_url || row.image_url,
      video: row.video_url,
    },
  }));

  const assetLinks = tracks.flatMap((track) => [
    track.assets.audio ? { type: 'audio', track_id: track.track_id, title: track.titulo, url: track.assets.audio } : null,
    track.assets.cover ? { type: 'cover', track_id: track.track_id, title: track.titulo, url: track.assets.cover } : null,
    track.assets.video ? { type: 'video', track_id: track.track_id, title: track.titulo, url: track.assets.video } : null,
  ]).filter(Boolean);

  const approved = tracks.filter((track) => track.audio_final_status === 'Aprobado').length;
  const ready = tracks.filter((track) => track.checklist.listo_para_subir).length;

  return {
    ok: true,
    exported_at: new Date().toISOString(),
    filters: {
      album_id: params.albumId || null,
      tipo: tipo || 'Todos',
    },
    summary: {
      workspaces: workspaces.length,
      tracks: tracks.length,
      audios_aprobados: approved,
      listos_para_subir: ready,
      assets: assetLinks.length,
    },
    workspaces,
    tracks,
    asset_links: assetLinks,
    instructions: [
      'Este paquete es el manifiesto maestro de distribución de JATune.',
      'Incluye URLs de audio, portada, video, metadata y checklist por canción.',
      'Para descarga física masiva, usar los asset_links o el botón de descarga de activos del dashboard.',
    ],
  };
};

export async function POST(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const albumId = body?.album_id ? Number(body.album_id) : null;
    const tipo = body?.tipo || null;
    const pkg = buildPackage({ albumId, tipo });

    return NextResponse.json(pkg, { status: 200, headers: getCorsHeaders(request) });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, code: 'EXPORT_DISTRIBUTION_FAILED', message: error?.message || 'No fue posible exportar paquete de distribución.' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}

export async function GET(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const albumId = url.searchParams.get('album_id') ? Number(url.searchParams.get('album_id')) : null;
  const tipo = url.searchParams.get('tipo');
  const pkg = buildPackage({ albumId, tipo });

  return NextResponse.json(pkg, { status: 200, headers: getCorsHeaders(request) });
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getCorsHeaders(request) });
}
