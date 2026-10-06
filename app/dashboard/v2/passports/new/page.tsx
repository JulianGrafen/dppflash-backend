'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileSpreadsheet, FileText, FolderOpen, Plug, Upload } from 'lucide-react';
import { createDraftId, seedDraftForMethod } from '@/app/dashboard/v2/context/DraftProvider';
import { useSession } from '@/app/dashboard/v2/context/SessionProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const BASE_METHODS = [
  {
    id: 'upload' as const,
    title: 'Dokumente hochladen',
    description: 'SDS, Datenblätter, Zertifikate per Drag & Drop — empfohlen',
    icon: Upload,
    primary: true,
    href: (id: string) => `/dashboard/v2/passports/new/${id}/upload`,
    requiresIntegration: false,
  },
  {
    id: 'import' as const,
    title: 'Daten importieren',
    description: 'CSV oder Excel (Demo: vorgefüllte Felder)',
    icon: FileSpreadsheet,
    primary: false,
    href: (id: string) => `/dashboard/v2/passports/new/${id}/review-data`,
    requiresIntegration: false,
  },
  {
    id: 'manual' as const,
    title: 'Manuell eingeben',
    description: 'Demo: startet mit KI-Vorschlagsfeldern',
    icon: FileText,
    primary: false,
    href: (id: string) => `/dashboard/v2/passports/new/${id}/review-data`,
    requiresIntegration: false,
  },
  {
    id: 'existing' as const,
    title: 'Bestehende Daten',
    description: 'Vorhandene Stammdaten übernehmen (Demo)',
    icon: FolderOpen,
    primary: false,
    href: (id: string) => `/dashboard/v2/passports/new/${id}/review-data`,
    requiresIntegration: false,
  },
] as const;

const INTEGRATION_METHODS = [
  {
    id: 'existing' as const,
    title: 'Aus SAP-Stammdaten',
    description: 'Nutzt die im Onboarding verbundene SAP-Demo-Sync',
    icon: Plug,
    primary: false,
    href: (id: string) => `/dashboard/v2/passports/new/${id}/review-data`,
    requiresIntegration: 'sap' as const,
  },
  {
    id: 'existing' as const,
    title: 'Aus PIM',
    description: 'Produktattribute aus dem konfigurierten PIM-Webhook (Demo)',
    icon: Plug,
    primary: false,
    href: (id: string) => `/dashboard/v2/passports/new/${id}/review-data`,
    requiresIntegration: 'pim' as const,
  },
] as const;

export default function NewPassportMethodPage() {
  const router = useRouter();
  const { session } = useSession();
  const sapOk = Boolean(session?.onboarding.sapConnected);
  const pimOk = Boolean(session?.onboarding.pimConfigured);

  const integrationMethods = INTEGRATION_METHODS.filter((m) => {
    if (m.requiresIntegration === 'sap') {
      return sapOk;
    }
    if (m.requiresIntegration === 'pim') {
      return pimOk;
    }
    return false;
  });

  const methods = [...BASE_METHODS, ...integrationMethods];

  function start(method: typeof BASE_METHODS[number]['id'], href: (id: string) => string) {
    const id = createDraftId();
    seedDraftForMethod(id, method);
    router.push(href(id));
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0c1929]">Wie möchten Sie den DPP erstellen?</h1>
        <p className="mt-2 text-sm text-slate-600">Wählen Sie einen Einstieg — Upload ist für die Demo optimiert.</p>
        {!sapOk && !pimOk ? (
          <p className="mt-2 text-xs text-slate-500">
            SAP/PIM-Shortcuts nach{' '}
            <Link href="/dashboard/v2/einstellungen" className="font-medium text-primary underline">
              Integrationen
            </Link>{' '}
            bzw. Onboarding.
          </p>
        ) : null}
      </div>
      <div className="space-y-3">
        {methods.map((method, index) => {
          const Icon = method.icon;
          return (
            <Card
              key={`${method.id}-${method.title}-${index}`}
              className={`cursor-pointer transition-shadow hover:shadow-md ${
                method.primary ? 'border-sky-300 ring-1 ring-sky-100' : ''
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 text-teal-700" aria-hidden />
                  <div>
                    <CardTitle className="text-base">{method.title}</CardTitle>
                    <CardDescription>{method.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  variant={method.primary ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => start(method.id, method.href)}
                >
                  {method.primary ? 'Mit Upload starten' : 'In Demo öffnen'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
