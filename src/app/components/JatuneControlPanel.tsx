'use client';

import { useEffect, useMemo, useState } from 'react';

type Summary = {
  artistas: number;
  albumes: number;
  workspaces?: number;
  workspaces_pendientes?: number;
  workspaces_creados?: number;
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
  workspace_status?: string;
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
  suno_workspace_id?: string;
  workspace_error?: string;
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

const sampleCatalog = `Zyphorix | Galactic Vibe | EP | Nebula Dance | Dembow Dominicano, Bajo Pesado, 120 BPM
Zyphorix | Galactic Vibe | EP | Solar Flare | Spatial Trap, Sintetizadores Futuristas
Velnora | Sentimiento Puro | Sencillo | Sabor Calle | Bachata Urbana, Guitarra Afilada
Jeantune | Amor Digital | Álbum | Besos en la Nube | Pop Urbano Romántico, Synth Latino, 95 BPM`;

const STORAGE_KEY = 'jatune_api_key';

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || data?.code || 'Solicitud fallida');
  }
  return data;
}

export default function JatuneControlPanel({ initialSummary, initialTracks }: Props) {
  const [summary, setSummary] = useState(initialSummary);
  const [tracks, setTracks] = useState(initialTracks);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [bulkText, setBulkText] = useState(sampleCatalog);
  const [apiKey, setApiKey] = useState('');
  const [rememberKey, setRememberKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('Todos');

  useEffect(() => {
    const savedKey = window.localStorage.getItem(STORAGE_KEY);
    if (savedKey) {
      setApiKey(savedKey);
      setRememberKey(true);
    }
    refreshCatalog().catch(() => undefined);
  }, []);

  const apiHeaders = useMemo<Record<string, string>>(() => {
    const cleanKey = apiKey.trim();
    return cleanKey ? { 'x-api-key': cleanKey } : {};
  }, [apiKey]);

  const saveKeyPreference = (key: string, remember: boolean) => {
    if (remember && key.trim()) window.localStorage.setItem(STORAGE_KEY, key.trim());
    else window.localStorage.removeItem(STORAGE_KEY);
  };

  const filteredTracks = useMemo(() => {
    if (filter === 'Todos') return tracks;
    return tracks.filter(track => track.estado === filter);
  }, [tracks, filter]);

  const refreshCatalog = async () => {
    const [summaryData, tracksData, workspaceData] = await Promise.all([
      apiRequest('/api/catalog/summary'),
      apiRequest('/api/catalog/tracks'),
      apiRequest('/api/catalog/workspaces'),
    ]);
    setSummary(summaryData.summary);
    setTracks(tracksData.tracks || []);
    setWorkspaces(workspaceData.workspaces || []);
  };

  const importCatalog = async () => {
    setBusy(true);
    setMessage('');
    saveKeyPreference(apiKey, rememberKey);
    try {
      const data = await apiRequest('/api/catalog/import', {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ text: bulkText }),
      });
      const planned = data.summary?.workspaces_planificados ?? 0;
      setMessage(`Catálogo importado: ${data.imported} registros. Workspaces planificados: ${planned}.`);
      await refreshCatalog();
    } catch (error: any) {
      setMessage(`Error: ${error.message}. Si configuraste JATUNE_API_KEY en Render, escríbela en el campo de clave antes de importar.`);
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
        headers: apiHeaders,
        body: JSON.stringify({ limit: 1, wait_audio: false, make_instrumental: false }),
      });
      setMessage(`Generación ejecutada: ${data.processed} canción procesada.`);
      await refreshCatalog();
    } catch (error: any) {
      setMessage(`Error: ${error.message}. Si configuraste JATUNE_API_KEY en Render, escríbela en el campo de clave antes de generar.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8 pb-24">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm text-slate-400">Artistas</p>
          <p className="mt-2 text-4xl font-black text-yellow-200">{summary.artistas}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm text-slate-400">Workspaces</p>
          <p className="mt-2 text-4xl font-black text-fuchsia-300">{summary.workspaces ?? summary.albumes}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm text-slate-400">Álbumes / EPs</p>
          <p className="mt-2 text-4xl font-black text-violet-300">{summary.albumes}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm text-slate-400">Canciones</p>
          <p className="mt-2 text-4xl font-black text-sky-300">{summary.canciones}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm text-slate-400">Pendientes</p>
          <p className="mt-2 text-4xl font-black text-emerald-300">{summary.pendientes}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-yellow-300/20 bg-yellow-300/10 p-5 text-sm text-yellow-50">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <p className="font-black text-yellow-200">Clave operativa del dashboard</p>
            <p className="mt-1 text-yellow-100/80">
              Si Render tiene configurada la variable <strong>JATUNE_API_KEY</strong>, pega aquí esa misma clave. El dashboard la envía como header <strong>x-api-key</strong> cuando importas catálogo o generas pendientes.
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-2 lg:w-[420px]">
            <input
              value={apiKey}
              onChange={event => setApiKey(event.target.value)}
              placeholder="Pega aquí tu JATUNE_API_KEY"
              className="min-h-12 w-full rounded-2xl border border-yellow-300/20 bg-slate-950 px-4 text-sm text-slate-100 outline-none ring-yellow-300/20 focus:ring-4"
              type="password"
            />
            <label className="flex items-center gap-2 text-xs text-yellow-100/80">
              <input
                type="checkbox"
                checked={rememberKey}
                onChange={event => {
                  setRememberKey(event.target.checked);
                  saveKeyPreference(apiKey, event.target.checked);
                }}
              />
              Recordar en este navegador
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl lg:p-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-black">Carga masiva estructurada</h2>
              <p className="mt-1 text-sm text-slate-400">Cada álbum/EP/sencillo se convierte en un workspace lógico para control tipo Suno.</p>
            </div>
            <button
              onClick={() => setBulkText(sampleCatalog)}
              className="rounded-full border border-white/10 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
            >
              Plantilla
            </button>
          </div>
          <textarea
            value={bulkText}
            onChange={event => setBulkText(event.target.value)}
            className="mt-5 h-72 w-full resize-y rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-100 outline-none ring-yellow-300/20 focus:ring-4"
          />
          <div className="mt-4 flex flex-col gap-3 lg:flex-row">
            <button
              onClick={importCatalog}
              disabled={busy}
              className="min-h-12 rounded-2xl bg-yellow-300 px-6 font-black text-slate-950 disabled:opacity-50"
            >
              {busy ? 'Procesando...' : 'Importar catálogo y crear workspaces'}
            </button>
            <button
              onClick={refreshCatalog}
              disabled={busy}
              className="min-h-12 rounded-2xl border border-white/10 bg-slate-900 px-6 font-black text-slate-100 disabled:opacity-50"
            >
              Refrescar
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl lg:p-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-black">Generación desde pendientes</h2>
              <p className="mt-1 text-sm text-slate-400">Procesa una canción pendiente por ejecución para cuidar estabilidad y créditos.</p>
            </div>
            <button
              onClick={generatePending}
              disabled={busy || summary.pendientes === 0}
              className="min-h-12 rounded-2xl bg-emerald-300 px-6 font-black text-slate-950 disabled:opacity-50"
            >
              {busy ? 'Procesando...' : 'Generar 1 pendiente'}
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-4"><p className="text-xs uppercase tracking-[0.25em] text-slate-500">Pendiente</p><p className="mt-2 text-2xl font-black text-yellow-200">{summary.pendientes}</p></div>
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-4"><p className="text-xs uppercase tracking-[0.25em] text-slate-500">Generando</p><p className="mt-2 text-2xl font-black text-sky-300">{summary.generando}</p></div>
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-4"><p className="text-xs uppercase tracking-[0.25em] text-slate-500">Completada</p><p className="mt-2 text-2xl font-black text-emerald-300">{summary.completadas}</p></div>
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-4"><p className="text-xs uppercase tracking-[0.25em] text-slate-500">Error</p><p className="mt-2 text-2xl font-black text-rose-300">{summary.errores}</p></div>
          </div>

          {message && <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-200">{message}</div>}
        </div>
      </div>

      <div className="rounded-3xl border border-fuchsia-300/20 bg-fuchsia-300/[0.06] p-6 shadow-xl lg:p-8">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black">Workspaces tipo Suno</h2>
            <p className="mt-1 text-sm text-slate-400">Estos son los nombres que JATune usará para llevar control por proyecto. La sincronización real con Suno será el siguiente conector.</p>
          </div>
          <span className="rounded-full border border-white/10 bg-slate-950 px-4 py-2 text-xs font-bold text-slate-300">
            {workspaces.length} workspaces planificados
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workspaces.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950 p-5 text-sm text-slate-400">Importa catálogo para crear workspaces lógicos.</div>
          ) : workspaces.slice(0, 12).map(workspace => (
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

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black">Catálogo musical</h2>
            <p className="mt-1 text-sm text-slate-400">Vista operativa Artista → Workspace/Proyecto → Track.</p>
          </div>
          <select value={filter} onChange={event => setFilter(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100">
            {['Todos', 'Pendiente', 'Generando', 'Completada', 'Error', 'Reintentar'].map(status => <option key={status}>{status}</option>)}
          </select>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
          <div className="min-w-[1080px]">
            <div className="grid grid-cols-12 bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              <div className="col-span-2">Artista</div><div className="col-span-3">Workspace</div><div className="col-span-2">Canción</div><div className="col-span-3">Prompt</div><div className="col-span-1">Estado</div><div className="col-span-1">Audio</div>
            </div>
            {filteredTracks.length === 0 ? (
              <div className="p-6 text-sm text-slate-400">No hay canciones para mostrar.</div>
            ) : filteredTracks.slice(0, 40).map(track => (
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
