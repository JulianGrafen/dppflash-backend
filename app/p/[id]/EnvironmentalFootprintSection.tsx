import { Droplets, Globe2 } from 'lucide-react';
import type { EsprProductData } from '../../types/espr';
import {
  resolveCo2FootprintDisplay,
  resolveWaterFootprintDisplay,
} from '@/app/domain/dpp/environmentalFootprintBenchmarks';
import { FootprintMetricRow } from './FootprintMetricRow';

type EnvironmentalFootprintSectionProps = {
  readonly raw: Record<string, unknown>;
  readonly carbonFootprint: EsprProductData['carbonFootprint'];
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function FootprintRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <dt className="text-[13px] font-medium leading-snug text-slate-500 sm:w-[40%] sm:shrink-0">{label}</dt>
      <dd className="text-[13px] font-semibold text-slate-900 sm:max-w-[58%] sm:text-right">{value}</dd>
    </div>
  );
}

/**
 * **ESPR-Umweltblock**: CO₂-Fußabdruck (Art. 7) und Umweltwirkung mit **stoffspezifischer Schätzung**
 * aus `chemicalComposition` oder statischem Branchen-Benchmark.
 */
export function EnvironmentalFootprintSection({
  raw,
  carbonFootprint,
}: EnvironmentalFootprintSectionProps) {
  const cf = asRecord(raw.carbonFootprint);
  const env = asRecord(raw.environmentalImpact);

  const co2 = resolveCo2FootprintDisplay(raw, carbonFootprint);
  const water = resolveWaterFootprintDisplay(raw);

  const lifecycleStage = cf ? asString(cf.lifecycleStage) : undefined;
  const calculationMethod = cf ? asString(cf.calculationMethod) : undefined;
  const impactNotes = env ? asString(env.impactNotes) : undefined;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]">
      <header className="flex items-start gap-3 bg-[#0c1929] px-5 py-4 text-white">
        <div
          className="flex shrink-0 items-center justify-center rounded-xl bg-white/[0.12] p-2.5"
          aria-hidden
        >
          <Globe2 size={22} strokeWidth={1.75} className="text-emerald-300" />
        </div>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-[15px] font-semibold tracking-tight">Umwelt & CO₂-Fußabdruck</h2>
          <p className="mt-1 text-[11px] font-semibold uppercase leading-snug tracking-[0.14em] text-slate-400">
            ESPR · Treibhausgas & Umweltwirkung
          </p>
        </div>
      </header>

      <dl className="divide-y divide-slate-100">
        <FootprintMetricRow
          label="CO₂-Fußabdruck"
          value={co2.display}
          estimateKind={co2.estimateKind}
          badge={co2.badge}
          tooltipText={co2.tooltip}
        />
        {lifecycleStage ? <FootprintRow label="Lebenszyklusphase" value={lifecycleStage} /> : null}
        {calculationMethod ? <FootprintRow label="Berechnungsmethode" value={calculationMethod} /> : null}
        {carbonFootprint.methodology ? (
          <FootprintRow label="Methodik" value={carbonFootprint.methodology} />
        ) : null}
        {carbonFootprint.certificationBody ? (
          <FootprintRow label="Zertifizierer" value={carbonFootprint.certificationBody} />
        ) : null}
      </dl>

      <div className="border-t border-slate-100 bg-gradient-to-b from-emerald-50/40 to-white">
        <div className="flex items-center gap-2 px-5 pb-1 pt-4">
          <Droplets size={16} strokeWidth={1.75} className="text-sky-700" aria-hidden />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700">Umweltwirkung</h3>
        </div>
        <dl className="divide-y divide-slate-100">
          <FootprintMetricRow
            label="Wasserfußabdruck"
            value={water.display}
            estimateKind={water.estimateKind}
            badge={water.badge}
            tooltipText={water.tooltip}
          />
          {impactNotes ? <FootprintRow label="Umwelthinweise" value={impactNotes} /> : null}
        </dl>
      </div>
    </section>
  );
}
