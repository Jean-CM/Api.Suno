import fs from 'node:fs';
import path from 'node:path';

export type AlbumType = 'Sencillo' | 'EP' | 'Álbum';
export type TrackStatus = 'Pendiente' | 'Generando' | 'Completada' | 'Error' | 'Reintentar' | 'Descartada' | 'Publicada' | 'Distribuida';
export type WorkspaceStatus = 'Pendiente' | 'Creado' | 'Error' | 'Sincronizar';

export type Artist = {
  id: number;
  nombre: string;
  fecha_creacion: string;
};

export type Album = {
  id: number;
  artista_id: number;
  titulo: string;
  tipo: AlbumType;
  fecha_creacion: string;
  suno_workspace_name: string;
  suno_workspace_id?: string;
  workspace_status: WorkspaceStatus;
  workspace_error?: string;
};

export type Track = {
  id: number;
  album_id: number;
  titulo: string;
  genero_prompt: string;
  audio_url?: string;
  image_url?: string;
  video_url?: string;
  clip_id?: string;
  estado: TrackStatus;
  error_detalle?: string;
  fecha_creacion: string;
  fecha_actualizacion?: string;
};

export type CatalogStore = {
  artists: Artist[];
  albums: Album[];
  tracks: Track[];
  nextArtistId: number;
  nextAlbumId: number;
  nextTrackId: number;
};

export type CatalogRow = {
  artista_id: number;
  artista: string;
  album_id: number;
  album: string;
  tipo: AlbumType;
  workspace_name: string;
  workspace_status: WorkspaceStatus;
  suno_workspace_id?: string;
  cancion_id: number;
  cancion: string;
  genero_prompt: string;
  estado: TrackStatus;
  audio_url?: string;
  image_url?: string;
  video_url?: string;
  clip_id?: string;
  error_detalle?: string;
  fecha_creacion: string;
  fecha_actualizacion?: string;
};

export type WorkspaceRow = {
  workspace_key: string;
  album_id: number;
  workspace_name: string;
  workspace_status: WorkspaceStatus;
  suno_workspace_id?: string;
  workspace_error?: string;
  artista: string;
  album: string;
  tipo: AlbumType;
  canciones: number;
  pendientes: number;
  completadas: number;
  fecha_creacion: string;
};

export type ImportRecord = {
  artista: string;
  album: string;
  tipo: AlbumType;
  cancion: string;
  genero_prompt: string;
};

export type ImportError = {
  linea: number;
  error: string;
  contenido: string;
};

const defaultStore = (): CatalogStore => ({
  artists: [],
  albums: [],
  tracks: [],
  nextArtistId: 1,
  nextAlbumId: 1,
  nextTrackId: 1,
});

const nowIso = () => new Date().toISOString();

const dataDir = () => {
  const configured = process.env.JATUNE_DATA_DIR;
  if (configured) return configured;
  if (fs.existsSync('/data')) return '/data';
  return path.join(process.cwd(), '.jatune-data');
};

const dataFile = () => path.join(dataDir(), 'catalog.json');

const ensureDataDir = () => {
  fs.mkdirSync(dataDir(), { recursive: true });
};

export const getCatalogStorageInfo = () => ({
  data_dir: dataDir(),
  data_file: dataFile(),
  persistent_recommended: process.env.JATUNE_DATA_DIR || fs.existsSync('/data') ? 'configured_or_detected' : 'ephemeral_fallback',
});

const normalizeAlbumForStore = (album: Partial<Album>): Album => {
  const title = String(album.titulo || 'Proyecto sin título').trim();
  return {
    id: Number(album.id || 0),
    artista_id: Number(album.artista_id || 0),
    titulo: title,
    tipo: (album.tipo || 'Sencillo') as AlbumType,
    fecha_creacion: album.fecha_creacion || nowIso(),
    suno_workspace_name: album.suno_workspace_name || title,
    suno_workspace_id: album.suno_workspace_id,
    workspace_status: album.workspace_status || 'Pendiente',
    workspace_error: album.workspace_error,
  };
};

export const readCatalogStore = (): CatalogStore => {
  ensureDataDir();
  const file = dataFile();
  if (!fs.existsSync(file)) return defaultStore();

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<CatalogStore>;
    return {
      ...defaultStore(),
      ...parsed,
      artists: parsed.artists || [],
      albums: (parsed.albums || []).map(album => normalizeAlbumForStore(album)),
      tracks: parsed.tracks || [],
    };
  } catch {
    return defaultStore();
  }
};

export const writeCatalogStore = (store: CatalogStore) => {
  ensureDataDir();
  const file = dataFile();
  const tempFile = `${file}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tempFile, file);
};

export const normalizeAlbumType = (raw: string): AlbumType => {
  const value = (raw || '').trim().toUpperCase();
  if (value === 'SENCILLO' || value === 'SINGLE') return 'Sencillo';
  if (value === 'EP') return 'EP';
  if (value === 'ALBUM' || value === 'ÁLBUM') return 'Álbum';
  throw new Error(`Tipo inválido: ${raw}. Usa Sencillo, EP o Álbum.`);
};

export const buildWorkspaceName = (artistName: string, albumTitle: string, type: AlbumType) => {
  const suffix = type === 'Sencillo' ? 'Single' : type;
  return `${albumTitle.trim()} · ${artistName.trim()} · ${suffix}`;
};

const getOrCreateArtist = (store: CatalogStore, nombre: string) => {
  const cleanName = nombre.trim();
  const existing = store.artists.find(a => a.nombre.toLowerCase() === cleanName.toLowerCase());
  if (existing) return existing;

  const artist: Artist = {
    id: store.nextArtistId++,
    nombre: cleanName,
    fecha_creacion: nowIso(),
  };
  store.artists.push(artist);
  return artist;
};

const getOrCreateAlbum = (store: CatalogStore, artist: Artist, titulo: string, tipo: AlbumType) => {
  const cleanTitle = titulo.trim();
  const existing = store.albums.find(a => a.artista_id === artist.id && a.titulo.toLowerCase() === cleanTitle.toLowerCase() && a.tipo === tipo);
  if (existing) {
    if (!existing.suno_workspace_name) existing.suno_workspace_name = buildWorkspaceName(artist.nombre, cleanTitle, tipo);
    if (!existing.workspace_status) existing.workspace_status = 'Pendiente';
    return existing;
  }

  const album: Album = {
    id: store.nextAlbumId++,
    artista_id: artist.id,
    titulo: cleanTitle,
    tipo,
    fecha_creacion: nowIso(),
    suno_workspace_name: buildWorkspaceName(artist.nombre, cleanTitle, tipo),
    workspace_status: 'Pendiente',
  };
  store.albums.push(album);
  return album;
};

const createOrUpdateTrack = (store: CatalogStore, albumId: number, titulo: string, generoPrompt: string) => {
  const cleanTitle = titulo.trim();
  const cleanPrompt = generoPrompt.trim();
  const existing = store.tracks.find(t => t.album_id === albumId && t.titulo.toLowerCase() === cleanTitle.toLowerCase());

  if (existing) {
    existing.genero_prompt = cleanPrompt;
    existing.fecha_actualizacion = nowIso();
    if (existing.estado === 'Error') existing.estado = 'Reintentar';
    return { track: existing, action: 'actualizada' as const };
  }

  const track: Track = {
    id: store.nextTrackId++,
    album_id: albumId,
    titulo: cleanTitle,
    genero_prompt: cleanPrompt,
    estado: 'Pendiente',
    fecha_creacion: nowIso(),
  };
  store.tracks.push(track);
  return { track, action: 'creada' as const };
};

export const parseBulkCatalogText = (text: string) => {
  const records: ImportRecord[] = [];
  const errors: ImportError[] = [];

  text.split(/\r?\n/).forEach((originalLine, index) => {
    const lineNumber = index + 1;
    const line = originalLine.trim();
    if (!line || line.startsWith('#')) return;
    if (lineNumber === 1 && line.toLowerCase().includes('artista') && line.toLowerCase().includes('canci')) return;

    const parts = line.split('|').map(part => part.trim());
    if (parts.length !== 5) {
      errors.push({ linea: lineNumber, error: 'La línea no tiene exactamente 5 columnas separadas por |.', contenido: originalLine });
      return;
    }

    const [artista, album, tipoRaw, cancion, generoPrompt] = parts;
    if (!artista || !album || !tipoRaw || !cancion || !generoPrompt) {
      errors.push({ linea: lineNumber, error: 'Hay campos vacíos.', contenido: originalLine });
      return;
    }

    try {
      records.push({ artista, album, tipo: normalizeAlbumType(tipoRaw), cancion, genero_prompt: generoPrompt });
    } catch (error: any) {
      errors.push({ linea: lineNumber, error: error.message, contenido: originalLine });
    }
  });

  return { records, errors };
};

export const importCatalogRecords = (records: ImportRecord[]) => {
  const store = readCatalogStore();
  const artistsSeen = new Set<string>();
  const albumsSeen = new Set<string>();
  let created = 0;
  let updated = 0;

  records.forEach(record => {
    const artist = getOrCreateArtist(store, record.artista);
    const album = getOrCreateAlbum(store, artist, record.album, record.tipo);
    const result = createOrUpdateTrack(store, album.id, record.cancion, record.genero_prompt);

    artistsSeen.add(artist.nombre.toLowerCase());
    albumsSeen.add(`${artist.id}-${album.titulo.toLowerCase()}-${album.tipo}`);
    if (result.action === 'creada') created += 1;
    else updated += 1;
  });

  writeCatalogStore(store);

  return {
    artistas_procesados: artistsSeen.size,
    albumes_procesados: albumsSeen.size,
    workspaces_planificados: albumsSeen.size,
    canciones_creadas: created,
    canciones_actualizadas: updated,
  };
};

export const getCatalogRows = (): CatalogRow[] => {
  const store = readCatalogStore();
  return store.tracks.map(track => {
    const album = store.albums.find(a => a.id === track.album_id);
    const artist = store.artists.find(a => a.id === album?.artista_id);
    return {
      artista_id: artist?.id || 0,
      artista: artist?.nombre || 'Sin artista',
      album_id: album?.id || 0,
      album: album?.titulo || 'Sin proyecto',
      tipo: album?.tipo || 'Sencillo',
      workspace_name: album?.suno_workspace_name || album?.titulo || 'Sin workspace',
      workspace_status: album?.workspace_status || 'Pendiente',
      suno_workspace_id: album?.suno_workspace_id,
      cancion_id: track.id,
      cancion: track.titulo,
      genero_prompt: track.genero_prompt,
      estado: track.estado,
      audio_url: track.audio_url,
      image_url: track.image_url,
      video_url: track.video_url,
      clip_id: track.clip_id,
      error_detalle: track.error_detalle,
      fecha_creacion: track.fecha_creacion,
      fecha_actualizacion: track.fecha_actualizacion,
    };
  });
};

export const getWorkspaceRows = (): WorkspaceRow[] => {
  const store = readCatalogStore();
  return store.albums.map(album => {
    const artist = store.artists.find(a => a.id === album.artista_id);
    const tracks = store.tracks.filter(t => t.album_id === album.id);
    return {
      workspace_key: `${album.id}-${album.suno_workspace_name}`,
      album_id: album.id,
      workspace_name: album.suno_workspace_name || album.titulo,
      workspace_status: album.workspace_status || 'Pendiente',
      suno_workspace_id: album.suno_workspace_id,
      workspace_error: album.workspace_error,
      artista: artist?.nombre || 'Sin artista',
      album: album.titulo,
      tipo: album.tipo,
      canciones: tracks.length,
      pendientes: tracks.filter(t => t.estado === 'Pendiente' || t.estado === 'Reintentar').length,
      completadas: tracks.filter(t => t.estado === 'Completada').length,
      fecha_creacion: album.fecha_creacion,
    };
  });
};

export const getCatalogSummary = () => {
  const store = readCatalogStore();
  const byStatus = store.tracks.reduce<Record<string, number>>((acc, track) => {
    acc[track.estado] = (acc[track.estado] || 0) + 1;
    return acc;
  }, {});

  const workspaces = getWorkspaceRows();

  return {
    artistas: store.artists.length,
    albumes: store.albums.length,
    workspaces: workspaces.length,
    workspaces_pendientes: workspaces.filter(w => w.workspace_status === 'Pendiente' || w.workspace_status === 'Sincronizar').length,
    workspaces_creados: workspaces.filter(w => w.workspace_status === 'Creado').length,
    canciones: store.tracks.length,
    pendientes: byStatus.Pendiente || 0,
    generando: byStatus.Generando || 0,
    completadas: byStatus.Completada || 0,
    errores: byStatus.Error || 0,
    por_estado: byStatus,
    storage: getCatalogStorageInfo(),
  };
};

export const getNextPendingTracks = (limit = 1) => {
  return getCatalogRows()
    .filter(row => row.estado === 'Pendiente' || row.estado === 'Reintentar')
    .slice(0, Math.max(1, Math.min(limit, 5)));
};

export const buildSunoPromptFromCatalogRow = (row: CatalogRow) => {
  return [
    `Crea una canción profesional para el artista ${row.artista}.`,
    `Título: ${row.cancion}.`,
    `Proyecto: ${row.album} (${row.tipo}).`,
    `Workspace de control: ${row.workspace_name}.`,
    `Estilo e instrucciones musicales: ${row.genero_prompt}.`,
    'Producción moderna, mezcla limpia, estructura comercial, melodía memorable y alto potencial para plataformas digitales.',
  ].join(' ');
};

export const updateTrackStatus = (trackId: number, updates: Partial<Track>) => {
  const store = readCatalogStore();
  const track = store.tracks.find(t => t.id === trackId);
  if (!track) throw new Error(`Track no encontrado: ${trackId}`);

  Object.assign(track, updates, { fecha_actualizacion: nowIso() });
  writeCatalogStore(store);
  return track;
};

export const updateWorkspaceStatus = (albumId: number, updates: Partial<Album>) => {
  const store = readCatalogStore();
  const album = store.albums.find(a => a.id === albumId);
  if (!album) throw new Error(`Workspace/álbum no encontrado: ${albumId}`);

  Object.assign(album, updates);
  writeCatalogStore(store);
  return album;
};

export const resetCatalog = () => {
  const store = defaultStore();
  writeCatalogStore(store);
  return store;
};
