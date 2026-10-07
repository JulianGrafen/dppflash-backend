'use client';

import { Check } from 'lucide-react';
import { INTEGRATION_DEFINITIONS, type IntegrationId } from './globalCatalogMock';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from 'cn';

type IntegrationsStepProps = {
  connected: Partial<Record<IntegrationId, boolean>>;
  onConnect: (id: IntegrationId) => void;
  onBack: () => void;
  onNext: () => void;
};

export function IntegrationsStep({ connected, onConnect, onBack, onNext }: IntegrationsStepProps) {
  const anyConnected = Object.values(connected).some(Boolean);

  return (
    <Card className="border-slate-200/90 shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">Connect your PIM &amp; ERP</CardTitle>
        <CardDescription>OAuth-Anbindung per Klick.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {INTEGRATION_DEFINITIONS.map((def) => {
            const isConnected = Boolean(connected[def.id]);
            const Icon = def.icon;
            return (
              <div
                key={def.id}
                className={cn(
                  'rounded-xl border p-4 transition-colors',
                  isConnected ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                      <Icon className="h-5 w-5 text-slate-700" aria-hidden />
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{def.name}</p>
                      <p className="text-xs text-slate-500">{def.description}</p>
                    </div>
                  </div>
                  {isConnected ? (
                    <Badge className="shrink-0 gap-1 border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      <Check className="h-3 w-3" aria-hidden />
                      Connected
                    </Badge>
                  ) : null}
                </div>
                {isConnected ? (
                  <p className="mt-3 text-xs font-medium text-emerald-800">{def.connectedStat}</p>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 cursor-pointer"
                    onClick={() => onConnect(def.id)}
                  >
                    Connect
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" className="cursor-pointer" onClick={onBack}>
            Zurück
          </Button>
          <Button type="button" className="cursor-pointer sm:min-w-40" disabled={!anyConnected} onClick={onNext}>
            Weiter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
