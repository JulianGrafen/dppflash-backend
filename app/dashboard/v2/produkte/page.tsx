'use client';

import { useEffect, useState } from 'react';
import { V2SectionShell } from '@/app/dashboard/v2/components/V2SectionShell';
import { loadAllDrafts } from '@/app/dashboard/v2/mock/storage';
import type { DraftPassport } from '@/app/dashboard/v2/mock/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ProduktePage() {
  const [drafts, setDrafts] = useState<DraftPassport[]>([]);

  useEffect(() => {
    setDrafts(loadAllDrafts());
  }, []);

  return (
    <V2SectionShell
      title="Produkte"
      description="Stammdaten und Produktidentität aus Ihren Entwürfen (Mock)."
    >
      <Card className="border-slate-200/90 shadow-sm">
        <CardContent className="divide-y divide-slate-100 p-0">
          {drafts.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-500">Noch keine Produkte erfasst.</p>
          ) : (
            drafts.map((draft) => (
              <div
                key={draft.id}
                className="flex flex-wrap items-center justify-between gap-2 px-6 py-4"
              >
                <div>
                  <p className="font-medium text-slate-900">{draft.productName}</p>
                  <p className="text-xs text-slate-500">Methode: {draft.creationMethod}</p>
                </div>
                <Badge variant="secondary">{draft.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </V2SectionShell>
  );
}
