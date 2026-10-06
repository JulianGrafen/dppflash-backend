'use client';

import { useEffect, useState } from 'react';
import { V2SectionShell } from '@/app/dashboard/v2/components/V2SectionShell';
import { loadAllDrafts } from '@/app/dashboard/v2/mock/storage';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type DocRow = { productName: string; name: string; status: string };

export default function DokumentePage() {
  const [rows, setRows] = useState<DocRow[]>([]);

  useEffect(() => {
    const drafts = loadAllDrafts();
    setRows(
      drafts.flatMap((d) =>
        d.documents.map((doc) => ({
          productName: d.productName,
          name: doc.name,
          status: doc.status,
        })),
      ),
    );
  }, []);

  return (
    <V2SectionShell
      title="Dokumente"
      description="Hochgeladene Nachweise und Extraktionsquellen pro Produktpass."
    >
      <Card className="border-slate-200/90 shadow-sm">
        <CardContent className="divide-y divide-slate-100 p-0">
          {rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-500">
              Noch keine Dokumente — starten Sie mit einem Upload im Wizard.
            </p>
          ) : (
            rows.map((row, i) => (
              <div
                key={`${row.productName}-${row.name}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 px-6 py-4"
              >
                <div>
                  <p className="font-medium text-slate-900">{row.name}</p>
                  <p className="text-xs text-slate-500">{row.productName}</p>
                </div>
                <Badge variant="secondary">{row.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </V2SectionShell>
  );
}
