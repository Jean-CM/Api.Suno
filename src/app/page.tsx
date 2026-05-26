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
    <section className="min-h-screen w-full bg-slate-950 px-3 py-5 text-white sm:px-5 lg:px-8 2xl:px-10 lg:py-8">
      <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-5 sm:gap-6 lg:gap-7">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-5 shadow-2xl sm:p-7 lg:p-9">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="mb-3 inline-flex rounded-full border border-yellow-300/30 bg-yellow-300/10 px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-yellow-200">
                JATune Production
              </p>
              <h1 className="max-w-5xl text-3xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Centro Ejecutivo de Producción Musical
              </h1>
              <p className="mt-4 max-w-4xl text-sm text-slate-300 sm:text-base lg:text-lg">
                Plataforma central para importar catálogo, generar tandas musicales con Suno, aprobar audios finales y descargar paquetes por álbum, EP o sencillo con metadata lista para operación.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <div className={`w-fit rounded-2xl border px-5 py-4 text-sm font-bold ${statusClass}`}>
                <span className="block text-xs uppercase tracking-[0.25em] opacity-80">Estado</span>
                {statusLabel}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-300 lg:justify-end">
                <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-2">Render: Online</span>
                <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-2">Cookie: {data.ok ? 'Vigente' : 'Validar'}</span>
                <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-2">Actualizado: {checkedAt}</span>
              </div>
            </div>
          </div>
        </div>

        {!data.ok && (
          <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-5 text-rose-100 sm:p-6">
            <h2 className="text-xl font-bold">Alerta del motor</h2>
            <p className="mt-2 text-sm text-rose-100/80">{data.error}</p>
            <p className="mt-4 text-sm text-rose-100/70">
              Revisa en Render que SUNO_COOKIE esté configurada y vigente. Sin cookie válida, el tablero vive, pero el motor no canta.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
            <p className="text-sm font-medium text-slate-400">Créditos disponibles</p>
            <p className="mt-3 text-3xl font-black text-emerald-300 sm:text-4xl">{formatNumber(limit.credits_left)}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.25em] text-slate-500">Suno balance</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
            <p className="text-sm font-medium text-slate-400">Uso mensual</p>
            <p className="mt-3 text-3xl font-black text-sky-300 sm:text-4xl">{formatNumber(limit.monthly_usage)}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.25em] text-slate-500">Créditos consumidos</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
            <p className="text-sm font-medium text-slate-400">Límite mensual</p>
            <p className="mt-3 text-3xl font-black text-violet-300 sm:text-4xl">{formatNumber(limit.monthly_limit)}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.25em] text-slate-500">Periodo: {limit.period || 'N/D'}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-6">
            <p className="text-sm font-medium text-slate-400">Consumo</p>
            <p className="mt-3 text-3xl font-black text-yellow-200 sm:text-4xl">{formatPercent(limit.monthly_usage, limit.monthly_limit)}</p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-yellow-300" style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
        </div>

        <JatuneControlPanel initialSummary={summary} initialTracks={tracks} />
      </div>
    </section>
  );
}
