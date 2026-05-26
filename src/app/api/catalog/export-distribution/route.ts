import { NextRequest, NextResponse } from 'next/server';
import { getCatalogRows, getWorkspaceRows } from '@/lib/JatuneCatalog';
import { getCorsHeaders, requireApiKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const checklistForTrack = (track: any) => ({
  audio_revisado: track.audio_final_status === 'Aprobado',
  audio_masterizado: track.master_status === 'Masterizada',
  metadata_completa: track.metadata_status === 'Completa',
  isrc_asignado: Boolean(track.isrc),
  fecha_lanzamiento_definida: Boolean(track.release_date),
  creditos_revisados: Boolean(track.credits),
  descripcion_lista: Boolean(track.description_short || track.description_long),
  listo_para_descargar: Boolean(track.audio_url) && track.audio_final_status === 'Aprobado',
  listo_para_distribuir: Boolean(track.audio_url) && track.audio_final_status === 'Aprobado' && track.metadata_status === 'Completa',
});

const normalizeType = (value?: string | null) => {
  if (!value || value === 'Todos') return null;
  const clean = value.trim().toUpperCase();
  if (clean === 'ALBUM' || clean === 'ÁLBUM') return 'Álbum';
  if (clean === 'EP') return 'EP';
  if (clean === 'SENCILLO' || clean === 'SINGLE') return 'Sencillo';
  return value;
};

const withWavPreference = (url?: string) => {
  if (!url) return undefined;
  if (url.toLowerCase().includes('.wav')) return url;
  return url;
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
    audio_url: withWavPreference(row.audio_url),
    requested_audio_format: 'WAV preferred; falls back to Suno provided audio_url if WAV URL is not exposed by API',
    clip_id: row.clip_id,
    duration: row.duration,
    versions_received: row.versions_received,
    selected_version_policy: row.selected_version_policy,
    audio_final_status: row.audio_final_status,
    master_status: row.master_status,
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
    checklist: checklistForTrack(row),
    assets: {
      audio: withWavPreference(row.audio_url),
    },
  }));

  const audioLinks = tracks
    .map((track) => track.assets.audio ? { type: 'audio', preferred_format: 'wav', track_id: track.track_id, title: track.titulo, url: track.assets.audio } : null)
    .filter(Boolean);

  const approved = tracks.filter((track) => track.audio_final_status === 'Aprobado').length;
  const ready = tracks.filter((track) => track.checklist.listo_para_distribuir).length;

  return {
    ok: true,
    exported_at: new Date().toISOString(),
    package_type: 'audio_and_metadata_only',
    filters: {
      album_id: params.albumId || null,
      tipo: tipo || 'Todos',
    },
    summary: {
      workspaces: workspaces.length,
      tracks: tracks.length,
      audios_aprobados: approved,
      listos_para_distribuir: ready,
      audio_assets: audioLinks.length,
    },
    workspaces,
    tracks,
    audio_links: audioLinks,
    instructions: [
      'Este paquete exporta solo audio y metadata. Portadas y visuales quedan fuera para mantener el sistema liviano.',
      'Formato preferido: WAV. Si Suno no expone URL WAV por API, se exporta el audio_url disponible y se mantiene la preferencia indicada en requested_audio_format.',
      'Para descargar WAV real, usar el enlace de Suno si está disponible en la cuenta o exportarlo manualmente desde la interfaz de Suno.',
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
      { ok: false, code: 'EXPORT_DISTRIBUTION_FAILED', message: error?.message || 'No fue posible exportar paquete de audio y metadata.' },
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
