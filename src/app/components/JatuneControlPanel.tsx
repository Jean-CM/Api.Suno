'use client';

import { useEffect, useMemo, useState } from 'react';

type Summary = {
  artistas: number;
  albumes: number;
  workspaces?: number;
  canciones: number;
  pendientes: number;
  generando: number;
  completadas: number;
  errores: number;
};

type Track = {
  cancion_id: number;
  artista: string;
  album_id: number;
  album: string;
  tipo: string;
  workspace_name?: string;
  cancion: string;
  genero_prompt: string;
  estado: string;
  audio_url?: string;
  clip_id?: string;
  duration?: string | number;
  error_detalle?: string;
};

type Workspace = {
  workspace_key: string;
  album_id: number;
  workspace_name: string;
  artista: string;
  album: string;
  tipo: string;
  canciones: number;
  pendientes: number;
  completadas: number;
};

type Props = {
  initialSummary: Summary;
  initialTracks: Track[];
};

type ApiOptions = {
  method?: 'GET' | 'POST';
  apiKey?: string;
  body?: string;
};

type DistributionPackage = {
  ok: boolean;
  summary: {
    tracks: number;
    audio_assets: number;
  };
  tracks: Array<any>;
  audio_links: Array<{ type: string; preferred_format: string; track_id: number; title: string; url: string }>;
};

const sampleCatalog = `Zyphorix | Galactic Vibe | EP | Nebula Dance | Dembow Dominicano, Bajo Pesado, 120 BPM
Zyphorix | Galactic Vibe | EP | Solar Flare | Spatial Trap, Sintetizadores Futuristas
Jeantune | Amor Digital | Álbum | Besos en la Nube | Pop Urbano Romántico, Synth Latino, 95 BPM
Velnora | Sentimiento Puro | Sencillo | Sabor Calle | Bachata Urbana, Guitarra Afilada`;

const STORAGE_KEY = 'jatune_api_key';

function buildHeaders(apiKey?: string): HeadersInit {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  const cleanKey = apiKey?.trim();
  if (cleanKey) headers.set('x-api-key', cleanKey);
  return headers;
}

async function apiRequest(path: string, options: ApiOptions = {}) {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method || 'GET',
      headers: buildHeaders(options.apiKey),
      body: options.body,
    });
  } catch (error: any) {
    throw new Error(error?.message === 'Load failed' ? 'La conexión se cortó mientras el servidor procesaba. Intenta nuevamente o reduce la tanda.' : error?.message || 'No fue posible conectar con el servidor.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.code || 'Solicitud fallida');
  return data;
}

const formatDuration = (duration?: string | number) => {
  if (!duration) return '—';
  const numeric = Number(duration);
  if (!Number.isFinite(numeric)) return String(duration);
  const minutes = Math.floor(numeric / 60);
  const seconds = Math.round(numeric % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const sunoStatusLabel = (track: Track) => {
  if (track.audio_url && track.estado === 'Completada') return 'Creada 100%';
  if (track.estado === 'Generando') return 'Generando';
  if (track.estado === 'Error') return 'Error';
  return track.estado;
};

export default function JatuneControlPanel({ initialSummary, initialTracks }: Props) {
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [bulkText, setBulkText] = useState(sampleCatalog);
  const [apiKey, setApiKey] = useState('');
  const [rememberKey, setRememberKey] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [exportType, setExportType] = useState('Todos');
  const [exportAlbumId, setExportAlbumId] = useState('');
  const [distributionPackage, setDistributionPackage] = useState<DistributionPackage | null>(null);

  const filteredTracks = filter === 'Todos' ? tracks : tracks.filter((track) => track.estado === filter);
  const errorTracks = tracks.filter((track) => track.estado === 'Error');
  const refreshCandidates = tracks.filter((track) => track.clip_id && (track.estado === 'Generando' || !track.audio_url));
  const exportProjects = useMemo(() => workspaces.filter((workspace) => exportType === 'Todos' || workspace.tipo === exportType), [workspaces, exportType]);
  const selectedProjectName = exportAlbumId ? exportProjects.find((workspace) => String(workspace.album_id) === exportAlbumId)?.album || 'proyecto' : 'catalogo';

  const saveKeyPreference = (key: string, remember: boolean) => {
    if (remember && key.trim()) window.localStorage.setItem(STORAGE_KEY, key.trim());
    else window.localStorage.removeItem(STORAGE_KEY);
  };

  const requireKey = () => {
    if (!apiKey.trim()) {
      setShowKeyModal(true);
      return false;
    }
    return true;
  };

  const refreshCatalog = async () => {
    const [summaryData, tracksData, workspaceData] = await Promise.all([
      apiRequest('/api/catalog/summary'),
      apiRequest('/api/catalog/tracks'),
      apiRequest('/api/catalog/workspaces'),
    ]);
    setSummary(summaryData.summary as Summary);
    setTracks((tracksData.tracks || []) as Track[]);
    setWorkspaces((workspaceData.workspaces || []) as Workspace[]);
  };

  useEffect(() => {
    const savedKey = window.localStorage.getItem(STORAGE_KEY);
    if (savedKey) {
      setApiKey(savedKey);
      setRememberKey(true);
    } else {
      setShowKeyModal(true);
    }
    refreshCatalog().catch(() => undefined);
  }, []);

  const importCatalog = async () => {
    if (!requireKey()) return;
    setBusy(true);
    setMessage('');
    saveKeyPreference(apiKey, rememberKey);
    try {
      const data = await apiRequest('/api/catalog/import', { method: 'POST', apiKey, body: JSON.stringify({ text: bulkText }) });
      setMessage(`Catálogo preparado: ${data.imported} registros listos para crear audio.`);
      await refreshCatalog();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Error desconocido';
      setMessage(`Error: ${detail}. Revisa JATUNE_API_KEY.`);
    } finally {
      setBusy(false);
    }
  };

  const generatePending = async () => {
    if (!requireKey()) return;
    setBusy(true);
    setMessage('Iniciando tanda estable: 5 audios en solicitudes pequeñas...');
    saveKeyPreference(apiKey, rememberKey);

    let processed = 0;
    let failed = 0;

    try {
      for (let i = 1; i <= 5; i += 1) {
        setMessage(`Generando audio ${i}/5...`);
        try {
          const data = await apiRequest('/api/catalog/generate-pending', {
            method: 'POST',
            apiKey,
            body: JSON.stringify({ limit: 1, wait_audio: false, make_instrumental: false }),
          });
          processed += Number(data.processed || 0);
          const hasError = (data.results || []).some((item: { ok: boolean }) => !item.ok);
          if (hasError) failed += 1;
          await refreshCatalog().catch(() => undefined);
        } catch {
          failed += 1;
        }
      }

      setMessage(failed > 0 ? `Tanda terminada: ${processed} enviada(s), ${failed} con error. Revisa errores recientes.` : `Tanda enviada: ${processed} canción(es). Ahora extrae los audios cuando Suno termine.`);
      await refreshCatalog();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Error desconocido';
      setMessage(`Error: ${detail}. Revisa JATUNE_API_KEY o SUNO_COOKIE.`);
    } finally {
      setBusy(false);
    }
  };

  const refreshGenerated = async () => {
    if (!requireKey()) return;
    setBusy(true);
    setMessage('');
    saveKeyPreference(apiKey, rememberKey);
    try {
      const data = await apiRequest('/api/catalog/refresh-generated', { method: 'POST', apiKey });
      setMessage(`Extracción completada: ${data.checked} audio(s) verificados desde Suno.`);
      await refreshCatalog();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Error desconocido';
      setMessage(`Error extrayendo audios: ${detail}`);
    } finally {
      setBusy(false);
    }
  };

  const retryErrors = async () => {
    if (!requireKey()) return;
    setBusy(true);
    setMessage('');
    saveKeyPreference(apiKey, rememberKey);
    try {
      const data = await apiRequest('/api/catalog/retry-errors', { method: 'POST', apiKey });
      setMessage(`Errores preparados para nueva tanda: ${data.updated}.`);
      await refreshCatalog();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Error desconocido';
      setMessage(`Error: ${detail}.`);
    } finally {
      setBusy(false);
    }
  };

  const exportDistribution = async () => {
    if (!requireKey()) return;
    setBusy(true);
    setMessage('');
    saveKeyPreference(apiKey, rememberKey);
    try {
      const payload: Record<string, string | number> = {};
      if (exportType !== 'Todos') payload.tipo = exportType;
      if (exportAlbumId) payload.album_id = Number(exportAlbumId);
      const data = await apiRequest('/api/catalog/export-distribution', { method: 'POST', apiKey, body: JSON.stringify(payload) });
      setDistributionPackage(data as DistributionPackage);
      setMessage(`Paquete detectado: ${data.summary?.tracks ?? 0} canciones, ${data.summary?.audio_assets ?? 0} audios listos.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Error desconocido';
      setMessage(`Error preparando descarga: ${detail}`);
    } finally {
      setBusy(false);
    }
  };

  const downloadAudioZip = async () => {
    if (!requireKey()) return;
    setBusy(true);
    setMessage('Preparando ZIP de audios MP3...');
    saveKeyPreference(apiKey, rememberKey);
    try {
      const payload: Record<string, string | number> = {};
      if (exportType !== 'Todos') payload.tipo = exportType;
      if (exportAlbumId) payload.album_id = Number(exportAlbumId);
      const response = await fetch('/api/catalog/download-audio-package', { method: 'POST', headers: buildHeaders(apiKey), body: JSON.stringify(payload) });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || 'No fue posible descargar el ZIP.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedProjectName.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'jatune'}-audios-mp3.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage('ZIP descargado: audios MP3.');
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Error desconocido';
      setMessage(`Error descargando ZIP: ${detail}`);
    } finally {
      setBusy(false);
    }
  };

  const metricCards: Array<[string, number, string]> = [
    ['Artistas', summary.artistas, 'text-yellow-200'],
    ['Proyectos', summary.workspaces ?? summary.albumes, 'text-fuchsia-300'],
    ['Canciones', summary.canciones, 'text-sky-300'],
    ['Completadas', summary.completadas, 'text-emerald-300'],
    ['Errores', summary.errores, 'text-rose-300'],
  ];

  return (
    <div className="space-y-6 pb-24">
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur">
          <div className="w-full max-w-xl rounded-3xl border border-yellow-300/20 bg-slate-950 p-6 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-yellow-200">Acceso operativo</p>
            <h2 className="mt-3 text-3xl font-black text-white">Conectar StudioCore</h2>
            <p className="mt-3 text-sm text-slate-300">Pega tu clave <strong>JATUNE_API_KEY</strong> para crear tandas, extraer audios y descargar proyectos.</p>
            <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="JATUNE_API_KEY" className="mt-5 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm text-slate-100 outline-none ring-yellow-300/20 focus:ring-4" type="password" autoFocus />
            <label className="mt-3 flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={rememberKey} onChange={(event) => setRememberKey(event.target.checked)} />Recordar en este navegador</label>
            <div className="mt-5 flex gap-3"><button onClick={() => { saveKeyPreference(apiKey, rememberKey); setShowKeyModal(false); }} className="rounded-2xl bg-yellow-300 px-5 py-3 text-sm font-black text-slate-950">Entrar al sistema</button><button onClick={() => setShowKeyModal(false)} className="rounded-2xl border border-white/10 bg-slate-900 px-5 py-3 text-sm font-black text-slate-100">Ahora no</button></div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{metricCards.map(([label, value, colorClass]) => <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl"><p className="text-sm text-slate-400">{label}</p><p className={`mt-2 text-3xl font-black ${colorClass}`}>{value}</p></div>)}</div>
        <button onClick={() => setShowKeyModal(true)} className="hidden rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-4 py-3 text-xs font-black text-yellow-100 xl:block">Clave</button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl lg:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-xl font-black sm:text-2xl">Vamos a divertirnos</h2><p className="mt-1 text-sm text-slate-400">Pega tus ideas y conviértelas en proyectos listos para crear audio.</p></div><button onClick={() => setBulkText(sampleCatalog)} className="rounded-full border border-white/10 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800">Plantilla</button></div>
          <textarea value={bulkText} onChange={(event) => setBulkText(event.target.value)} className="mt-5 h-80 w-full resize-y rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-100 outline-none ring-yellow-300/20 focus:ring-4" />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><button onClick={importCatalog} disabled={busy} className="min-h-12 rounded-2xl bg-yellow-300 px-6 font-black text-slate-950 disabled:opacity-50">{busy ? 'Procesando...' : 'Vamos a divertirnos'}</button><button onClick={refreshCatalog} disabled={busy} className="min-h-12 rounded-2xl border border-white/10 bg-slate-900 px-6 font-black text-slate-100 disabled:opacity-50">Actualizar vista</button></div>
        </div>

        <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.05] p-5 shadow-xl lg:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black sm:text-2xl">Producción musical</h2><p className="mt-1 text-sm text-slate-400">Crea tandas estables de 5 canciones, una solicitud a la vez, y extrae los audios cuando Suno finalice.</p></div><button onClick={generatePending} disabled={busy || summary.pendientes === 0} className="min-h-12 rounded-2xl bg-emerald-300 px-6 font-black text-slate-950 disabled:opacity-50">{busy ? 'Procesando...' : 'Generar audios'}</button></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Pend.', summary.pendientes, 'text-yellow-200'], ['Gen.', summary.generando, 'text-sky-300'], ['OK', summary.completadas, 'text-emerald-300'], ['Error', summary.errores, 'text-rose-300']].map(([label, value, colorClass]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-slate-900 p-4"><p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p><p className={`mt-2 text-2xl font-black ${colorClass}`}>{value}</p></div>)}</div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><button onClick={refreshGenerated} disabled={busy || refreshCandidates.length === 0} className="min-h-11 rounded-2xl border border-sky-300/30 bg-sky-300/10 px-5 text-sm font-black text-sky-100 disabled:opacity-50">Extraer audios desde Suno ({refreshCandidates.length})</button>{errorTracks.length > 0 && <button onClick={retryErrors} disabled={busy} className="min-h-11 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-5 text-sm font-black text-rose-100 disabled:opacity-50">Reintentar errores ({errorTracks.length})</button>}</div>
          {message && <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-200">{message}</div>}
        </div>
      </div>

      <div className="rounded-3xl border border-fuchsia-300/20 bg-fuchsia-300/[0.06] p-5 shadow-xl lg:p-7"><h2 className="text-xl font-black sm:text-2xl">Proyectos en Producción</h2><p className="mt-1 text-sm text-slate-400">Control por Álbum, EP o Sencillo. Es la vista que mantiene el orden cuando el catálogo crece.</p><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{workspaces.length === 0 ? <div className="rounded-2xl border border-white/10 bg-slate-950 p-5 text-sm text-slate-400">Prepara un catálogo para crear proyectos.</div> : workspaces.slice(0, 16).map((workspace) => <div key={workspace.workspace_key} className="rounded-2xl border border-white/10 bg-slate-950 p-5"><p className="text-xs uppercase tracking-[0.25em] text-fuchsia-200/70">Proyecto</p><h3 className="mt-2 text-lg font-black text-white">{workspace.workspace_name}</h3><p className="mt-3 text-sm text-slate-400">{workspace.artista} · {workspace.tipo}</p><div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-white/[0.04] p-3"><p className="text-slate-500">Tracks</p><p className="text-lg font-black text-white">{workspace.canciones}</p></div><div className="rounded-xl bg-white/[0.04] p-3"><p className="text-slate-500">Pend.</p><p className="text-lg font-black text-yellow-200">{workspace.pendientes}</p></div><div className="rounded-xl bg-white/[0.04] p-3"><p className="text-slate-500">OK</p><p className="text-lg font-black text-emerald-300">{workspace.completadas}</p></div></div></div>)}</div></div>

      <div className="rounded-3xl border border-amber-300/20 bg-amber-300/[0.06] p-5 shadow-xl lg:p-7"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-xl font-black sm:text-2xl">Descargar audios MP3</h2><p className="mt-1 text-sm text-slate-400">Elige un álbum, EP o sencillo y descarga un ZIP solo con los audios.</p></div><div className="grid gap-3 sm:grid-cols-3 lg:min-w-[760px]"><select value={exportType} onChange={(event) => { setExportType(event.target.value); setExportAlbumId(''); }} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100">{['Todos', 'Álbum', 'EP', 'Sencillo'].map((item) => <option key={item}>{item}</option>)}</select><select value={exportAlbumId} onChange={(event) => setExportAlbumId(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100"><option value="">Todos los proyectos</option>{exportProjects.map((workspace) => <option key={workspace.album_id} value={workspace.album_id}>{workspace.album} · {workspace.artista}</option>)}</select><button onClick={exportDistribution} disabled={busy} className="rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50">Ver audios</button></div></div>{distributionPackage && <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950 p-5"><div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-slate-500">Canciones</p><p className="text-2xl font-black text-white">{distributionPackage.summary.tracks}</p></div><div><p className="text-xs text-slate-500">Audios disponibles</p><p className="text-2xl font-black text-amber-200">{distributionPackage.summary.audio_assets}</p></div></div><div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><button onClick={downloadAudioZip} disabled={busy} className="min-h-11 rounded-2xl bg-amber-300 px-5 text-sm font-black text-slate-950 disabled:opacity-50">Descargar ZIP MP3</button></div></div>}</div>

      {errorTracks.length > 0 && <div className="rounded-3xl border border-rose-300/20 bg-rose-300/[0.06] p-5 shadow-xl lg:p-7"><h2 className="text-xl font-black text-rose-100 sm:text-2xl">Errores recientes</h2><div className="mt-5 space-y-3">{errorTracks.slice(0, 6).map((track) => <div key={track.cancion_id} className="rounded-2xl border border-white/10 bg-slate-950 p-4"><p className="font-bold text-white">{track.artista} · {track.cancion}</p><p className="mt-2 text-sm text-rose-100/80">{track.error_detalle || 'Sin detalle del error.'}</p></div>)}</div></div>}

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl lg:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black sm:text-2xl">Catálogo musical</h2><p className="mt-1 text-sm text-slate-400">Vista operativa Artista → Proyecto → Track.</p></div><select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100">{['Todos', 'Pendiente', 'Generando', 'Completada', 'Error', 'Reintentar'].map((status) => <option key={status}>{status}</option>)}</select></div><div className="mt-6 overflow-x-auto rounded-2xl border border-white/10"><div className="min-w-[1320px]"><div className="grid grid-cols-12 bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500"><div className="col-span-2">Artista</div><div className="col-span-2">Proyecto</div><div className="col-span-2">Canción</div><div className="col-span-2">Estado Suno</div><div className="col-span-1">Duración</div><div className="col-span-1">Audio</div><div className="col-span-2">Prompt</div></div>{filteredTracks.length === 0 ? <div className="p-6 text-sm text-slate-400">No hay canciones para mostrar.</div> : filteredTracks.slice(0, 80).map((track) => <div key={track.cancion_id} className="grid grid-cols-12 border-t border-white/10 px-4 py-4 text-sm text-slate-200"><div className="col-span-2 font-semibold">{track.artista}</div><div className="col-span-2 truncate text-slate-300">{track.workspace_name || track.album}</div><div className="col-span-2 text-slate-300">{track.cancion}</div><div className="col-span-2"><span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs font-bold">{sunoStatusLabel(track)}</span></div><div className="col-span-1 text-slate-300">{formatDuration(track.duration)}</div><div className="col-span-1">{track.audio_url ? <a className="text-yellow-200 underline" href={track.audio_url} target="_blank">Abrir</a> : <span className="text-slate-600">—</span>}</div><div className="col-span-2 truncate text-slate-500">{track.genero_prompt}</div></div>)}</div></div></div>
    </div>
  );
}
