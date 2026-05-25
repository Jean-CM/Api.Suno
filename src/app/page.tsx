import JatuneControlPanel from './components/JatuneControlPanel';
import { getCatalogRows, getCatalogSummary } from '@/lib/JatuneCatalog';
import { sunoApi } from '@/lib/SunoApi';

export const dynamic = 'force-dynamic';

type LimitInfo = {
  credits_left?: number;
  period?: string;
  monthly_limit?: number;
  monthly_usage?: number;
};

type DashboardData = {
  ok: boolean;
  limit?: LimitInfo;
  error?: string;
};

async function getDashboardData(): Promise<DashboardData> {
  try {
    const api = await sunoApi();
    const limit = await api.get_credits() as LimitInfo;
    return { ok: true, limit };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || 'No fue posible consultar el estado del servicio.'
    };
  }
}

const formatNumber = (value?: number) =>
  typeof value === 'number' ? new Intl.NumberFormat('es-DO').format(value) : 'N/D';

const formatPercent = (usage?: number, limit?: number) => {
  if (!usage || !limit) return '0%';
  return `${Math.min(100, Math.round((usage / limit) * 100))}%`;
};

const getUsagePercent = (usage?: number, limit?: number) => {
  if (!usage || !limit) return 0;
  return Math.min(100, Math.round((usage / limit) * 100));
};

export default async function Home() {
  const data = await getDashboardData();
  const summary = getCatalogSummary();
  const tracks = getCatalogRows();
  const limit = data.limit || {};
  const usagePercent = getUsagePercent(limit.monthly_usage, limit.monthly_limit);
  const statusLabel = data.ok ? 'Operativo' : 'Requiere atención';
  const statusClass = data.ok ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200';
  const checkedAt = new Date().toLocaleString('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  return (
    <section className="w-full min-h-screen bg-slate-950 text-white px-4 py-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-6 shadow-2xl lg:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border border-yellow-300/30 bg-yellow-300/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-yellow-200">
                JATune Production
              </p>
              <h1 className="text-4xl font-black tracking-tight lg:text-6xl">
                Centro de Control Musical
              </h1>
              <p className="mt-4 max-w-3xl text-base text-slate-300 lg:text-lg">
                Cabina central para operar el catálogo completo: créditos, carga masiva, generación desde pendientes e historial musical en Render.
              </p>
            </div>
            <div className={`w-fit rounded-2xl border px-5 py-4 text-sm font-bold ${statusClass}`}>
              <span className="block text-xs uppercase tracking-[0.25em] opacity-80">Estado</span>
              {statusLabel}
            </div>
          </div>
        </div>

        {!data.ok && (
          <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-6 text-rose-100">
            <h2 className="text-xl font-bold">Alerta del motor</h2>
            <p className="mt-2 text-sm text-rose-100/80">{data.error}</p>
            <p className="mt-4 text-sm text-rose-100/70">
              Revisa en Render que SUNO_COOKIE esté configurada y vigente. Sin cookie válida, el tablero vive, pero el motor no canta.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl">
            <p className="text-sm font-medium text-slate-400">Créditos disponibles</p>
            <p className="mt-3 text-4xl font-black text-emerald-300">{formatNumber(limit.credits_left)}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.25em] text-slate-500">Suno balance</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl">
            <p className="text-sm font-medium text-slate-400">Uso mensual</p>
            <p className="mt-3 text-4xl font-black text-sky-300">{formatNumber(limit.monthly_usage)}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.25em] text-slate-500">Créditos consumidos</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl">
            <p className="text-sm font-medium text-slate-400">Límite mensual</p>
            <p className="mt-3 text-4xl font-black text-violet-300">{formatNumber(limit.monthly_limit)}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.25em] text-slate-500">Periodo: {limit.period || 'N/D'}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl">
            <p className="text-sm font-medium text-slate-400">Consumo</p>
            <p className="mt-3 text-4xl font-black text-yellow-200">{formatPercent(limit.monthly_usage, limit.monthly_limit)}</p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-yellow-300" style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl lg:p-8">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-black">Panel operativo</h2>
                <p className="mt-1 text-sm text-slate-400">Resumen para operar generación musical sin entrar al log de Render a ciegas.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-slate-900 px-4 py-2 text-xs text-slate-300">
                Última lectura: {checkedAt}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Render</p>
                <p className="mt-2 text-lg font-bold text-white">Online</p>
                <p className="mt-2 text-sm text-slate-400">Servicio web activo.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Cookie</p>
                <p className="mt-2 text-lg font-bold text-white">{data.ok ? 'Vigente' : 'Validar'}</p>
                <p className="mt-2 text-sm text-slate-400">No se expone ningún secreto.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">API</p>
                <p className="mt-2 text-lg font-bold text-white">/api/generate</p>
                <p className="mt-2 text-sm text-slate-400">Motor principal listo.</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl lg:p-8">
            <h2 className="text-2xl font-black">Roadmap inmediato</h2>
            <div className="mt-6 space-y-4">
              {[
                ['01', 'Carga masiva Artista → Proyecto → Track'],
                ['02', 'Generación desde canciones pendientes'],
                ['03', 'Historial con audio_url y clip_id'],
                ['04', 'Persistencia con disco/DB en Render']
              ].map(([step, title]) => (
                <div key={step} className="flex gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-300 text-sm font-black text-slate-950">{step}</span>
                  <p className="pt-2 text-sm font-semibold text-slate-200">{title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <JatuneControlPanel initialSummary={summary} initialTracks={tracks} />

        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-400">
          <strong className="text-slate-200">Endpoint base:</strong> https://api-suno-nptk.onrender.com · <strong className="text-slate-200">Catálogo:</strong> /api/catalog/tracks · <strong className="text-slate-200">Importar:</strong> /api/catalog/import · <strong className="text-slate-200">Producción:</strong> configura JATUNE_API_KEY.
        </div>
      </div>
    </section>
  );
}
