'use client';

import { useState } from 'react';
import { Check, Copy, FolderOpen, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from 'cn';

type ComplianceInboxStepProps = {
  inboxEmail: string;
  files: File[];
  onFiles: (files: File[]) => void;
  onBack: () => void;
  onStartSync: () => void;
};

export function ComplianceInboxStep({
  inboxEmail,
  files,
  onFiles,
  onBack,
  onStartSync,
}: ComplianceInboxStepProps) {
  const [copied, setCopied] = useState(false);

  function copyEmail() {
    void navigator.clipboard.writeText(inboxEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="border-slate-200/90 shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">Set up your Compliance Inbox</CardTitle>
        <CardDescription>
          Forward supplier emails and PDFs directly to our AI Extraction Engine.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <Mail className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <code className="min-w-0 flex-1 truncate text-sm text-slate-800">{inboxEmail}</code>
          <Button type="button" variant="outline" size="sm" className="cursor-pointer gap-1" onClick={copyEmail}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            Copy
          </Button>
        </div>

        <label
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-6 py-16 text-center transition-colors hover:border-primary/40 hover:bg-white',
          )}
        >
          <FolderOpen className="mb-3 h-10 w-10 text-slate-400" aria-hidden />
          <span className="text-sm font-semibold text-slate-900">
            Or drop your legacy ZIP files and PDF folders here
          </span>
          <span className="mt-2 text-xs text-slate-500">
            {files.length > 0 ? `${files.length} Datei(en) ausgewählt` : 'Drag & Drop oder Ordner wählen'}
          </span>
          <input
            type="file"
            className="sr-only"
            multiple
            // @ts-expect-error folder pick
            webkitdirectory=""
            onChange={(e) => {
              if (e.target.files) {
                onFiles(Array.from(e.target.files));
              }
            }}
          />
        </label>

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onBack}>
            Zurück
          </Button>
          <Button type="button" className="flex-1 cursor-pointer" onClick={onStartSync}>
            Start Global Sync
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
