'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from 'cn';
import {
  ANALYTICS_KPIS,
  COMPLETENESS_WEEKLY,
  SCAN_WEEKLY,
  SUPPLIER_RESPONSE_ROWS,
} from './analyticsMock';

function maxOf(values: readonly number[]): number {
  return Math.max(...values, 1);
}

const CHART_HEIGHT_PX = 128;
const Y_TICK_COUNT = 4;

function axisMaxFromData(dataMax: number, fixedMax?: number): number {
  if (fixedMax != null) return fixedMax;
  const padded = dataMax * 1.08;
  if (padded <= 100) return 100;
  const stepCandidates = [10, 20, 25, 50, 100, 200, 250, 500];
  for (const step of stepCandidates) {
    const candidate = Math.ceil(padded / step) * step;
    if (candidate >= padded) return candidate;
  }
  return Math.ceil(padded / 100) * 100;
}

function buildYAxisTicks(axisMax: number): number[] {
  const step = axisMax / Y_TICK_COUNT;
  return Array.from({ length: Y_TICK_COUNT + 1 }, (_, i) => Math.round(axisMax - i * step));
}

function BarChart({
  data,
  className,
  barClassName,
  yAxisMax,
  formatYAxis,
}: {
  readonly data: readonly { label: string; value: number }[];
  readonly className?: string;
  readonly barClassName?: string;
  readonly yAxisMax?: number;
  readonly formatYAxis?: (value: number) => string;
}) {
  const dataMax = maxOf(data.map((d) => d.value));
  const axisMax = axisMaxFromData(dataMax, yAxisMax);
  const yTicks = buildYAxisTicks(axisMax);
  const formatTick = formatYAxis ?? ((value: number) => value.toLocaleString('de-DE'));

  return (
    <div className={cn('flex gap-2', className)}>
      <div
        className="flex w-9 shrink-0 flex-col justify-between text-right text-[10px] font-medium tabular-nums text-slate-500"
        style={{ height: CHART_HEIGHT_PX }}
        aria-hidden
      >
        {yTicks.map((tick) => (
          <span key={tick}>{formatTick(tick)}</span>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div
          className="relative flex items-end justify-between gap-2 border-l border-b border-slate-200/90 pl-2"
          style={{ height: CHART_HEIGHT_PX }}
        >
          {yTicks.slice(1, -1).map((tick) => (
            <div
              key={`grid-${tick}`}
              className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-slate-100"
              style={{ bottom: `${(tick / axisMax) * 100}%` }}
            />
          ))}
          {data.map((point) => (
            <div key={point.label} className="relative z-[1] flex min-w-0 flex-1 flex-col items-center justify-end h-full">
              <div
                className={cn('w-full max-w-[2.5rem] rounded-t-md transition-all', barClassName ?? 'bg-primary/80')}
                style={{ height: `${Math.round((point.value / axisMax) * 100)}%` }}
                title={`${point.label}: ${formatTick(point.value)}`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between gap-2 pl-2">
          {data.map((point) => (
            <span key={point.label} className="min-w-0 flex-1 text-center text-[10px] font-medium text-slate-500">
              {point.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsMockDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ANALYTICS_KPIS.map((kpi) => (
          <Card key={kpi.label} className="border-slate-200/90 bg-white shadow-sm">
            <CardContent className="px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-primary">{kpi.value}</p>
              <p className="mt-1 text-xs text-slate-500">{kpi.hint}</p>
              {kpi.trend ? (
                <p className="mt-2 text-xs font-medium text-emerald-700">{kpi.trend}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200/90 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#0c1929]">
              Vollständigkeit über Zeit
            </CardTitle>
            <p className="text-xs text-slate-500">Portfolio-Durchschnitt · wöchentlich (Mock)</p>
          </CardHeader>
          <CardContent>
            <BarChart
              data={COMPLETENESS_WEEKLY}
              barClassName="bg-sky-600/85"
              yAxisMax={100}
              formatYAxis={(v) => `${v} %`}
            />
          </CardContent>
        </Card>

        <Card className="border-slate-200/90 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#0c1929]">QR-Scans</CardTitle>
            <p className="text-xs text-slate-500">Letzte 7 Tage · alle veröffentlichten Pässe (Mock)</p>
          </CardHeader>
          <CardContent>
            <BarChart data={SCAN_WEEKLY} barClassName="bg-primary/75" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200/90 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-[#0c1929]">
            Lieferanten-Response (Magic Links)
          </CardTitle>
          <p className="text-xs text-slate-500">Gesendet vs. beantwortet · Demo-Stammdaten</p>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[28rem]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Supplier-Domain
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Gesendet
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Beantwortet
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Ø Tage
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SUPPLIER_RESPONSE_ROWS.map((row) => {
                const rate = row.sent > 0 ? Math.round((row.answered / row.sent) * 100) : 0;
                return (
                  <TableRow key={row.domain}>
                    <TableCell className="font-medium text-slate-800">{row.domain}</TableCell>
                    <TableCell className="tabular-nums text-slate-600">{row.sent}</TableCell>
                    <TableCell>
                      <span className="tabular-nums text-slate-800">{row.answered}</span>
                      <span className="ml-2 text-xs text-slate-500">({rate} %)</span>
                    </TableCell>
                    <TableCell className="tabular-nums text-slate-600">{row.avgDays.toFixed(1)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-slate-400">
        Demo-Dashboard — keine Live-Anbindung an Scan- oder Outreach-Events.
      </p>
    </div>
  );
}
