'use client';

import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const SYNC_LINES = [
  { key: 'pim' as const, label: 'Fetching master data from Akeneo PIM…' },
  { key: 'llm' as const, label: 'Extracting UN 38.3 parameters from Magic Inbox PDFs using LLM…' },
  { key: 'merge' as const, label: 'Merging AI extracted data with PIM SKUs…' },
];

type AiSyncMergeStepProps = {
  progress: { pim: number; llm: number; merge: number };
};

export function AiSyncMergeStep({ progress }: AiSyncMergeStepProps) {
  return (
    <Card className="border-slate-200/90 shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">AI Sync &amp; Merge Engine</CardTitle>
        <CardDescription>Structured PIM data and unstructured inbox assets are unified.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {SYNC_LINES.map(({ key, label }) => {
          const value = progress[key];
          const done = value >= 100;
          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-slate-800">{label}</span>
                {done ? (
                  <span className="text-xs font-medium text-emerald-700">Done</span>
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
                )}
              </div>
              <Progress value={value} className="h-2" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
