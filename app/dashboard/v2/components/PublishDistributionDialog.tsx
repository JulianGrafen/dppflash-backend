'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { useDraft } from '@/app/dashboard/v2/context/DraftProvider';
import {
  PUBLISH_CHANNELS,
  animateChannelProgress,
  buildPublishManifest,
  buildPublishPreflightChecks,
  preflightReady,
  type PublishChannelId,
} from '@/app/dashboard/v2/lib/publishDistribution';
import type { DraftPassport } from '@/app/dashboard/v2/mock/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress';

type ChannelState = 'pending' | 'running' | 'done' | 'error';

type PublishDistributionDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly draft: DraftPassport;
  readonly criticalOk: boolean;
  readonly onPublished?: (publicUrl: string) => void;
};

export function PublishDistributionDialog({
  open,
  onOpenChange,
  draft,
  criticalOk,
  onPublished,
}: PublishDistributionDialogProps) {
  const { publish } = useDraft();
  const manifest = useMemo(() => buildPublishManifest(draft), [draft]);
  const preflight = useMemo(
    () => buildPublishPreflightChecks(draft, criticalOk),
    [draft, criticalOk],
  );
  const canStart = preflightReady(preflight);

  const [phase, setPhase] = useState<'checks' | 'running' | 'done' | 'error'>('checks');
  const [channelState, setChannelState] = useState<Record<PublishChannelId, ChannelState>>({
    'eu-registry': 'pending',
    'eu-customs': 'pending',
    'public-resolver': 'pending',
  });
  const [channelProgress, setChannelProgress] = useState<Record<PublishChannelId, number>>({
    'eu-registry': 0,
    'eu-customs': 0,
    'public-resolver': 0,
  });
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setPhase('checks');
    setChannelState({
      'eu-registry': 'pending',
      'eu-customs': 'pending',
      'public-resolver': 'pending',
    });
    setChannelProgress({
      'eu-registry': 0,
      'eu-customs': 0,
      'public-resolver': 0,
    });
    setPublicUrl(null);
    setErrorMessage(null);
  }, [open, draft.id]);

  async function runChannel(id: PublishChannelId, runTask?: () => Promise<void>) {
    setChannelState((prev) => ({ ...prev, [id]: 'running' }));
    setChannelProgress((prev) => ({ ...prev, [id]: 0 }));
    const progressPromise = animateChannelProgress((pct) => {
      setChannelProgress((prev) => ({ ...prev, [id]: pct }));
    });
    const taskPromise = runTask?.() ?? Promise.resolve();
    await Promise.all([progressPromise, taskPromise]);
    setChannelState((prev) => ({ ...prev, [id]: 'done' }));
  }

  async function startDistribution() {
    if (!canStart) {
      return;
    }
    setPhase('running');
    setErrorMessage(null);

    try {
      await runChannel('eu-registry');
      await runChannel('eu-customs');
      let resolvedUrl: string | null = null;
      await runChannel('public-resolver', async () => {
        const result = await publish();
        if (!result) {
          throw new Error('Resolver / Host nicht erreichbar');
        }
        resolvedUrl = result.publicUrl;
        setPublicUrl(resolvedUrl);
      });
      setPhase('done');
      if (resolvedUrl) {
        onPublished?.(resolvedUrl);
      }
    } catch (error) {
      setPhase('error');
      setErrorMessage(error instanceof Error ? error.message : 'Übermittlung fehlgeschlagen');
      setChannelState((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next) as PublishChannelId[]) {
          if (next[key] === 'running') {
            next[key] = 'error';
          }
        }
        return next;
      });
    }
  }

  const overallProgress =
    (channelProgress['eu-registry'] +
      channelProgress['eu-customs'] +
      channelProgress['public-resolver']) /
    3;

  function statusIcon(state: ChannelState) {
    if (state === 'done') {
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />;
    }
    if (state === 'error') {
      return <XCircle className="h-4 w-4 text-red-600" aria-hidden />;
    }
    if (state === 'running') {
      return <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />;
    }
    return <Circle className="h-4 w-4 text-slate-300" aria-hidden />;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,44rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Veröffentlichung &amp; Schnittstellen</DialogTitle>
          <DialogDescription>
            Demo-Übermittlung an EU-Register, Zoll und Public Resolver. Keine Live-Anbindung an
            Kommission oder ATLAS.
          </DialogDescription>
        </DialogHeader>

        {phase === 'checks' ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600">
              <p className="font-medium text-slate-800">Geplante Payload (Auszug)</p>
              <ul className="mt-2 space-y-1 font-mono text-[11px]">
                <li>UPI: {manifest.upi}</li>
                <li>Operator: {manifest.economicOperatorId}</li>
                <li>Daten-Host: {manifest.dataHostUrl}</li>
                <li>Zolltarif: {manifest.customsTariff}</li>
              </ul>
            </div>
            <ul className="space-y-2">
              {preflight.map((check) => (
                <li key={check.id} className="flex items-start gap-2 text-sm">
                  {check.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{check.label}</p>
                    {check.detail ? (
                      <p className="text-xs text-slate-500 break-all">{check.detail}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-600">
                <span>Gesamtfortschritt</span>
                <span className="tabular-nums">{Math.round(overallProgress)} %</span>
              </div>
              <Progress value={overallProgress} className="w-full">
                <ProgressTrack className="h-2">
                  <ProgressIndicator />
                </ProgressTrack>
              </Progress>
            </div>
            <ul className="space-y-4">
              {PUBLISH_CHANNELS.map((channel) => {
                const state = channelState[channel.id];
                const pct = channelProgress[channel.id];
                return (
                  <li key={channel.id} className="space-y-2 rounded-lg border border-slate-200/90 p-3">
                    <div className="flex items-start gap-2">
                      {statusIcon(state)}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{channel.title}</p>
                        <p className="text-xs text-slate-500">{channel.subtitle}</p>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-slate-500">{pct} %</span>
                    </div>
                    <Progress value={pct} className="w-full">
                      <ProgressTrack className="h-1.5">
                        <ProgressIndicator />
                      </ProgressTrack>
                    </Progress>
                    <ul className="text-[11px] text-slate-500">
                      {channel.payloadHints.map((hint) => (
                        <li key={hint}>· {hint}</li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
            {phase === 'done' && publicUrl ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-900">
                Alle Kanäle bestätigt.{' '}
                <Link href={publicUrl} className="font-medium underline" target="_blank" rel="noopener noreferrer">
                  Public Resolver öffnen
                </Link>
              </p>
            ) : null}
            {errorMessage ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {errorMessage}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {phase === 'checks' ? (
            <>
              <Button type="button" variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button
                type="button"
                className="cursor-pointer"
                disabled={!canStart}
                onClick={() => void startDistribution()}
              >
                Übermittlung starten
              </Button>
            </>
          ) : phase === 'done' ? (
            <Button type="button" className="cursor-pointer" onClick={() => onOpenChange(false)}>
              Schließen
            </Button>
          ) : phase === 'error' ? (
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
              Schließen
            </Button>
          ) : (
            <p className="text-xs text-slate-500">Übermittlung läuft — bitte Fenster geöffnet lassen.</p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
