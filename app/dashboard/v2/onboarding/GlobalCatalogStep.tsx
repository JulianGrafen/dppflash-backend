'use client';

import { CheckCircle2, Link2 } from 'lucide-react';
import { CATALOG_SUMMARY, MASTER_CATALOG_ROWS } from './globalCatalogMock';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from 'cn';

type GlobalCatalogStepProps = {
  bulkRequestSent: boolean;
  onTriggerMagicLinks: () => void;
  onGoToDashboard: () => void;
};

function completionBadgeClass(completion: number): string {
  if (completion >= 100) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (completion >= 80) {
    return 'border-amber-200 bg-amber-50 text-amber-900';
  }
  return 'border-red-200 bg-red-50 text-red-800';
}

export function GlobalCatalogStep({
  bulkRequestSent,
  onTriggerMagicLinks,
  onGoToDashboard,
}: GlobalCatalogStepProps) {
  return (
    <div className="space-y-4">
      {bulkRequestSent ? (
        <div
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <div>
            <p className="font-semibold">Magic Links queued</p>
            <p className="mt-0.5 text-emerald-800">
              Bulk supplier outreach for {CATALOG_SUMMARY.gapsIdentified.toLocaleString('de-DE')} SKUs
              has been simulated.
            </p>
          </div>
        </div>
      ) : null}

      <Card className="border-slate-200/90 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-xl">Company Data Ingest Complete</CardTitle>
          <CardDescription>
            Total SKUs: {CATALOG_SUMMARY.totalSkus.toLocaleString('de-DE')} | Fully Compliant:{' '}
            {CATALOG_SUMMARY.fullyCompliant.toLocaleString('de-DE')} | Gaps Identified:{' '}
            {CATALOG_SUMMARY.gapsIdentified.toLocaleString('de-DE')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" className="cursor-pointer gap-2" onClick={onTriggerMagicLinks}>
              <Link2 className="h-4 w-4" aria-hidden />
              Trigger Magic Links for Missing Data ({CATALOG_SUMMARY.gapsIdentified.toLocaleString('de-DE')}{' '}
              SKUs)
            </Button>
            <Button type="button" variant="outline" className="cursor-pointer" onClick={onGoToDashboard}>
              Zum Dashboard
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Completion</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {MASTER_CATALOG_ROWS.map((row) => (
                  <tr key={row.sku} className="bg-white">
                    <td className="px-4 py-3 font-mono text-xs text-slate-800">{row.sku}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="px-4 py-3 text-slate-600">{row.source}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={cn(completionBadgeClass(row.completion))}>
                        {row.completion}%
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
