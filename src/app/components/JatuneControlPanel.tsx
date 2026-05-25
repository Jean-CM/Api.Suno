'use client';

import { useMemo, useState } from 'react';

type Summary = {
  artistas: number;
  albumes: number;
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
  cancion: string;
  genero_prompt: string;
  estado: string;
  audio_url?: string;
};

type Props = {
  initialSummary: Summary;
  initialTracks: Track[];
};

const sampleCatalog = `Zyphorix | Galactic Vibe | EP | Nebula Dance | Dembow Dominicano, Bajo Pesado, 120 BPM
Zyphorix | Galactic Vibe | EP | Solar Flare | Spatial Trap, Sintetizadores Futuristas
Velnora | Sentimiento Puro | Sencillo | Sabor Calle | Bachata Urbana, Guitarra Afilada
Jeantune | Amor Digital | Álbum | Besos en la Nube | Pop Urbano Romántico, Synth Latino, 95 BPM`;

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
  const [bulkText, setBulkText] = useState(sampleCatalog);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('Todos');

  const filteredTracks = useMemo(() => {
    if (filter === 'Todos') return tracks;
    return tracks.filter(track => track.estado === filter);
  }, [tracks, filter]);

  const refreshCatalog = async () => {
    const [summaryData, tracksData] = await Promise.all([
      apiRequest('/api/catalog/summary'),
      apiRequest('/api/catalog/tracks'),
    ]);
    setSummary(summaryData.summary);
    setTracks(tracksData.tracks || []);
  };

  const importCatalog = async () => {
    setBusy(true);
    setMessage('');
    try {
      const data = await apiRequest('/api/catalog/import', {
        method: 'POST',
        headers: apiKey ? { 'x-api-key': apiKey } : {},
        body: JSON.stringify({ text: bulkText }),
      });
      setMessage(`Catálogo importado: ${data.imported} registros procesados.`);
      await refreshCatalog();
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  const generatePending = async () => {
    setBusy(true);
    setMessage('');
    try {
      const data = await apiRequest('/api/catalog/generate-pending', {
        method: 'POST',
        headers: apiKey ? { 'x-api-key': apiKey } : {},
        body: JSON.stringify({ limit: 1, wait_audio: false, make_instrumental: false }),
      });
      setMessage(`Generación ejecutada: ${data.processed} canción procesada.`);
      await refreshCatalog();
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm text-slate-400">Artistas</p>
          <p className="mt-2 text-4xl font-black text-yellow-200">{summary.artistas}</p>
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

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl lg:p-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-black">Carga masiva estructurada</h2>
              <p className="mt-1 text-sm text-slate-400">Formato: Artista | Álbum/EP/Sencillo | Tipo | Canción | Prompt musical</p>
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
            className="mt-5 h-64 w-full rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-100 outline-none ring-yellow-300/20 focus:ring-4"
          />
          <div className="mt-4 flex flex-col gap-3 lg:flex-row">
            <input
              value={apiKey}
              onChange={event => setApiKey(event.target.value)}
              placeholder="JATUNE_API_KEY si está configurada"
              className="min-h-12 flex-1 rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm text-slate-100 outline-none ring-yellow-300/20 focus:ring-4"
              type="password"
            />
            <button
              onClick={importCatalog}
              disabled={busy}
              className="min-h-12 rounded-2xl bg-yellow-300 px-6 font-black text-slate-950 disabled:opacity-50"
            >
              Importar catálogo
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
              Generar 1 pendiente
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Pendiente</p>
              <p className="mt-2 text-2xl font-black text-yellow-200">{summary.pendientes}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Generando</p>
              <p className="mt-2 text-2xl font-black text-sky-300">{summary.generando}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Completada</p>
              <p className="mt-2 text-2xl font-black text-emerald-300">{summary.completadas}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Error</p>
              <p className="mt-2 text-2xl font-black text-rose-300">{summary.errores}</p>
            </div>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-200">
              {message}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black">Catálogo musical</h2>
            <p className="mt-1 text-sm text-slate-400">Vista operativa Artista → Proyecto → Track.</p>
          </div>
          <select
            value={filter}
            onChange={event => setFilter(event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          >
            {['Todos', 'Pendiente', 'Generando', 'Completada', 'Error', 'Reintentar'].map(status => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-12 bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            <div className="col-span-3">Artista</div>
            <div className="col-span-3">Proyecto</div>
            <div className="col-span-3">Canción</div>
            <div className="col-span-2">Estado</div>
            <div className="col-span-1">Audio</div>
          </div>
          {filteredTracks.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">No hay canciones para mostrar.</div>
          ) : filteredTracks.slice(0, 40).map(track => (
            <div key={track.cancion_id} className="grid grid-cols-12 border-t border-white/10 px-4 py-4 text-sm text-slate-200">
              <div className="col-span-3 font-semibold">{track.artista}</div>
              <div className="col-span-3 text-slate-300">{track.album} <span className="text-slate-500">({track.tipo})</span></div>
              <div className="col-span-3 text-slate-300">{track.cancion}</div>
              <div className="col-span-2">
                <span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs font-bold">{track.estado}</span>
              </div>
              <div className="col-span-1">
                {track.audio_url ? <a className="text-yellow-200 underline" href={track.audio_url} target="_blank">Abrir</a> : <span className="text-slate-600">—</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
