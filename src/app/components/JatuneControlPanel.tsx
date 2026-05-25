'use client';

import { useEffect, useState } from 'react';

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
  album: string;
  tipo: string;
  workspace_name?: string;
  cancion: string;
  genero_prompt: string;
  estado: string;
  audio_url?: string;
};

type Workspace = {
  workspace_key: string;
  album_id: number;
  workspace_name: string;
  workspace_status: string;
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

const sampleCatalog = `Zyphorix | Galactic Vibe | EP | Nebula Dance | Dembow Dominicano, Bajo Pesado, 120 BPM
Zyphorix | Galactic Vibe | EP | Solar Flare | Spatial Trap, Sintetizadores Futuristas
Velnora | Sentimiento Puro | Sencillo | Sabor Calle | Bachata Urbana, Guitarra Afilada
Jeantune | Amor Digital | Álbum | Besos en la Nube | Pop Urbano Romántico, Synth Latino, 95 BPM`;

const STORAGE_KEY = 'jatune_api_key';

function buildHeaders(apiKey?: string): HeadersInit {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  const cleanKey = apiKey?.trim();
  if (cleanKey) headers.set('x-api-key', cleanKey);
  return headers;
}

async function apiRequest(path: string, options: ApiOptions = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: buildHeaders(options.apiKey),
    body: options.body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.code || 'Solicitud fallida');
  }
  return data;
}

export default function JatuneControlPanel({ initialSummary, initialTracks }: Props) {
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [bulkText, setBulkText] = useState(sampleCatalog);
  const [apiKey, setApiKey] = useState('');
  const [rememberKey, setRememberKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('Todos');

  const filteredTracks = filter === 'Todos' ? tracks : tracks.filter((track) => track.estado === filter);

  const saveKeyPreference = (key: string, remember: boolean) => {
    if (remember && key.trim()) {
      window.localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
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
    }
    refreshCatalog().catch(() => undefined);
  }, []);

  const importCatalog = async () => {
    setBusy(true);
    setMessage('');
    saveKeyPreference(apiKey, rememberKey);

    try {
      const data = await apiRequest('/api/catalog/import', {
        method: 'POST',
        apiKey,
        body: JSON.stringify({ text: bulkText }),
      });

      const planned = data.summary?.workspaces_planificados ?? 0;
      setMessage(`Catálogo importado: ${data.imported} registros. Workspaces planificados: ${planned}.`);
      await refreshCatalog();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Error desconocido';
      setMessage(`Error: ${detail}. Revisa que JATUNE_API_KEY sea igual a la variable configurada en Render.`);
    } finally {
      setBusy(false);
    }
  };

  const generatePending = async () => {
    setBusy(true);
    setMessage('');
    saveKeyPreference(apiKey, rememberKey);

    try {
      const data = await apiRequest('/api/catalog/generate-pending', {
        method: 'POST',
        apiKey,
        body: JSON.stringify({ limit: 1, wait_audio: false, make_instrumental: false }),
      });

      setMessage(`Generación ejecutada: ${data.processed} canción procesada.`);
      await refreshCatalog();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Error desconocido';
      setMessage(`Error: ${detail}. Revisa que JATUNE_API_KEY sea igual a la variable configurada en Render.`);
    } finally {
      setBusy(false);
    }
  };

  const metricCards: Array<[string, number, string]> = [
    ['Artistas', summary.artistas, 'text-yellow-200'],
    ['Workspaces', summary.workspaces ?? summary.albumes, 'text-fuchsia-300'],
    ['Álbumes / EPs', summary.albumes, 'text-violet-300'],
    ['Canciones', summary.canciones, 'text-sky-300'],
    ['Pendientes', summary.pendientes, 'text-emerald-300'],
  ];

  return (
    <div className="space-y-6 pb-24">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {metricCards.map(([label, value, colorClass]) => (
          <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
            <p className="text-sm text-slate-400">{label}</p>
            <p className={`mt-2 text-3xl font-black ${colorClass}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-yellow-300/20 bg-yellow-300/10 p-5 text-sm text-yellow-50">
        <div className="grid gap-4 lg:grid-cols-[1fr_420px] lg:items-end">
          <div>
            <p className="font-black text-yellow-200">Clave operativa del dashboard</p>
            <p className="mt-1 text-yellow-100/80">
              Pega aquí la misma clave configurada en Render como <strong>JATUNE_API_KEY</strong>. Se enviará como header <strong>x-api-key</strong> al importar o generar.
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Pega aquí tu JATUNE_API_KEY"
              className="min-h-12 w-full rounded-2xl border border-yellow-300/20 bg-slate-950 px-4 text-sm text-slate-100 outline-none ring-yellow-300/20 focus:ring-4"
              type="password"
            />
            <label className="flex items-center gap-2 text-xs text-yellow-100/80">
              <input
                type="checkbox"
                checked={rememberKey}
                onChange={(event) => {
                  setRememberKey(event.target.checked);
                  saveKeyPreference(apiKey, event.target.checked);
                }}
              />
              Recordar en este navegador
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl lg:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-black sm:text-2xl">Carga masiva estructurada</h2>
              <p className="mt-1 text-sm text-slate-400">Cada proyecto se convierte en workspace lógico tipo Suno.</p>
            </div>
            <button onClick={() => setBulkText(sampleCatalog)} className="rounded-full border border-white/10 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800">
              Plantilla
            </button>
          </div>
          <textarea
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            className="mt-5 h-72 w-full resize-y rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-100 outline-none ring-yellow-300/20 focus:ring-4"
          />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button onClick={importCatalog} disabled={busy} className="min-h-12 rounded-2xl bg-yellow-300 px-6 font-black text-slate-950 disabled:opacity-50">
              {busy ? 'Procesando...' : 'Importar catálogo y crear workspaces'}
            </button>
            <button onClick={refreshCatalog} disabled={busy} className="min-h-12 rounded-2xl border border-white/10 bg-slate-900 px-6 font-black text-slate-100 disabled:opacity-50">
              Refrescar
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl lg:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black sm:text-2xl">Generación desde pendientes</h2>
              <p className="mt-1 text-sm text-slate-400">Procesa una canción por ejecución para cuidar estabilidad y créditos.</p>
            </div>
            <button onClick={generatePending} disabled={busy || summary.pendientes === 0} className="min-h-12 rounded-2xl bg-emerald-300 px-6 font-black text-slate-950 disabled:opacity-50">
              {busy ? 'Procesando...' : 'Generar 1 pendiente'}
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Pendiente', summary.pendientes, 'text-yellow-200'],
              ['Generando', summary.generando, 'text-sky-300'],
              ['Completada', summary.completadas, 'text-emerald-300'],
              ['Error', summary.errores, 'text-rose-300'],
            ].map(([label, value, colorClass]) => (
              <div key={String(label)} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
                <p className={`mt-2 text-2xl font-black ${colorClass}`}>{value}</p>
              </div>
            ))}
          </div>

          {message && <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-200">{message}</div>}
        </div>
      </div>

      <div className="rounded-3xl border border-fuchsia-300/20 bg-fuchsia-300/[0.06] p-5 shadow-xl lg:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black sm:text-2xl">Workspaces tipo Suno</h2>
            <p className="mt-1 text-sm text-slate-400">Nombres planificados para llevar control por proyecto.</p>
          </div>
          <span className="w-fit rounded-full border border-white/10 bg-slate-950 px-4 py-2 text-xs font-bold text-slate-300">
            {workspaces.length} planificados
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workspaces.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950 p-5 text-sm text-slate-400">Importa catálogo para crear workspaces lógicos.</div>
          ) : workspaces.slice(0, 12).map((workspace) => (
            <div key={workspace.workspace_key} className="rounded-2xl border border-white/10 bg-slate-950 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-fuchsia-200/70">Workspace</p>
                  <h3 className="mt-2 text-lg font-black text-white">{workspace.workspace_name}</h3>
                </div>
                <span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">{workspace.workspace_status}</span>
              </div>
              <p className="mt-3 text-sm text-slate-400">{workspace.artista} · {workspace.tipo}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-white/[0.04] p-3"><p className="text-slate-500">Tracks</p><p className="text-lg font-black text-white">{workspace.canciones}</p></div>
                <div className="rounded-xl bg-white/[0.04] p-3"><p className="text-slate-500">Pend.</p><p className="text-lg font-black text-yellow-200">{workspace.pendientes}</p></div>
                <div className="rounded-xl bg-white/[0.04] p-3"><p className="text-slate-500">OK</p><p className="text-lg font-black text-emerald-300">{workspace.completadas}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl lg:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black sm:text-2xl">Catálogo musical</h2>
            <p className="mt-1 text-sm text-slate-400">Vista operativa Artista → Workspace/Proyecto → Track.</p>
          </div>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100">
            {['Todos', 'Pendiente', 'Generando', 'Completada', 'Error', 'Reintentar'].map((status) => <option key={status}>{status}</option>)}
          </select>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
          <div className="min-w-[1080px]">
            <div className="grid grid-cols-12 bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              <div className="col-span-2">Artista</div>
              <div className="col-span-3">Workspace</div>
              <div className="col-span-2">Canción</div>
              <div className="col-span-3">Prompt</div>
              <div className="col-span-1">Estado</div>
              <div className="col-span-1">Audio</div>
            </div>
            {filteredTracks.length === 0 ? (
              <div className="p-6 text-sm text-slate-400">No hay canciones para mostrar.</div>
            ) : filteredTracks.slice(0, 40).map((track) => (
              <div key={track.cancion_id} className="grid grid-cols-12 border-t border-white/10 px-4 py-4 text-sm text-slate-200">
                <div className="col-span-2 font-semibold">{track.artista}</div>
                <div className="col-span-3 text-slate-300">{track.workspace_name || track.album}</div>
                <div className="col-span-2 text-slate-300">{track.cancion}</div>
                <div className="col-span-3 truncate text-slate-500">{track.genero_prompt}</div>
                <div className="col-span-1"><span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs font-bold">{track.estado}</span></div>
                <div className="col-span-1">{track.audio_url ? <a className="text-yellow-200 underline" href={track.audio_url} target="_blank">Abrir</a> : <span className="text-slate-600">—</span>}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
