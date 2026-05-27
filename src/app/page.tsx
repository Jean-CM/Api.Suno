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
  const checkedAt = new Date().toLocaleString('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const usageCards = [
    {
      label: 'Créditos disponibles',
      value: formatNumber(limit.credits_left),
      caption: 'Balance activo en Suno',
      accent: 'text-emerald-300'
    },
    {
      label: 'Uso mensual',
      value: formatNumber(limit.monthly_usage),
      caption: 'Créditos consumidos',
      accent: 'text-sky-300'
    },
    {
      label: 'Límite mensual',
      value: formatNumber(limit.monthly_limit),
      caption: `Periodo: ${limit.period || 'N/D'}`,
      accent: 'text-violet-300'
    },
  ];

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#030712] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.14),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.16),transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_45%,#020617_100%)]" />

      <section className="mx-auto flex w-full max-w-[1840px] flex-col gap-6 px-3 py-4 sm:px-5 lg:px-8 2xl:px-10 lg:py-8">
        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl backdrop-blur sm:p-7 lg:p-9">
            <div className="absolute right-0 top-0 h-52 w-52 translate-x-16 -translate-y-16 rounded-full bg-yellow-300/10 blur-3xl" />
            <div className="relative">
              <p className="inline-flex rounded-full border border-yellow-300/30 bg-yellow-300/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.35em] text-yellow-200">
                JATune Production
              </p>
              <h1 className="mt-5 max-w-5xl text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl">
                Centro Ejecutivo de Producción Musical
              </h1>
              <p className="mt-5 max-w-4xl text-sm leading-7 text-slate-300 sm:text-base lg:text-lg">
                Opera catálogo, tandas de generación, extracción de audios, aprobación final y descarga por proyecto desde una cabina central en Render.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {['Importar catálogo', 'Generar 5 pendientes', 'Aprobar audios', 'Descargar ZIP'].map((step, index) => (
                  <div key={step} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Paso {index + 1}</p>
                    <p className="mt-2 text-sm font-bold text-slate-100">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-2xl backdrop-blur sm:p-6 lg:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Estado operativo</p>
                <h2 className="mt-3 text-3xl font-black text-white">{statusLabel}</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${data.ok ? 'bg-emerald-300/15 text-emerald-200 ring-1 ring-emerald-300/30' : 'bg-rose-300/15 text-rose-200 ring-1 ring-rose-300/30'}`}>
                {data.ok ? 'Online' : 'Validar'}
              </span>
            </div>

            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                <span>Render</span>
                <strong className="text-emerald-300">Activo</strong>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                <span>Cookie Suno</span>
                <strong className={data.ok ? 'text-emerald-300' : 'text-rose-300'}>{data.ok ? 'Vigente' : 'Revisar'}</strong>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                <span className="block text-slate-500">Última lectura</span>
                <strong className="mt-1 block text-slate-100">{checkedAt}</strong>
              </div>
            </div>
          </aside>
        </div>

        {!data.ok && (
          <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-5 text-rose-100 shadow-xl sm:p-6">
            <h2 className="text-xl font-bold">Alerta del motor</h2>
            <p className="mt-2 text-sm text-rose-100/80">{data.error}</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {usageCards.map((card) => (
            <div key={card.label} className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-xl backdrop-blur sm:p-6">
              <p className="text-sm font-medium text-slate-400">{card.label}</p>
              <p className={`mt-3 text-3xl font-black sm:text-4xl ${card.accent}`}>{card.value}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.25em] text-slate-500">{card.caption}</p>
            </div>
          ))}

          <div className="rounded-3xl border border-yellow-300/20 bg-yellow-300/[0.06] p-5 shadow-xl backdrop-blur sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-yellow-100/80">Consumo</p>
                <p className="mt-3 text-3xl font-black text-yellow-200 sm:text-4xl">{formatPercent(limit.monthly_usage, limit.monthly_limit)}</p>
              </div>
              <span className="rounded-full border border-yellow-300/20 bg-slate-950/50 px-3 py-1 text-xs font-bold text-yellow-100">Mes</span>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-950/80">
              <div className="h-full rounded-full bg-yellow-300 shadow-[0_0_24px_rgba(250,204,21,0.45)]" style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
        </div>

        <JatuneControlPanel initialSummary={summary} initialTracks={tracks} />
      </section>
    </main>
  );
}
