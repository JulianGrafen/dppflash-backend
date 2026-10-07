import { buildPublicDppPassportUrl } from '@/app/lib/publicDppUrl';
import { resolveDraftPublishPassId } from '@/app/dashboard/v2/mock/passportFields';
import type { DraftPassport } from '@/app/dashboard/v2/mock/types';

export type PublishChannelId = 'eu-registry' | 'eu-customs' | 'public-resolver';

export type PublishChannelDefinition = {
  id: PublishChannelId;
  title: string;
  subtitle: string;
  payloadHints: readonly string[];
};

export const PUBLISH_CHANNELS: readonly PublishChannelDefinition[] = [
  {
    id: 'eu-registry',
    title: 'EU-Zentralregister (DPP Registry)',
    subtitle: 'Central Web Portal der EU-Kommission — Metadaten-Meldung (kein PDF-Upload).',
    payloadHints: ['UPI (Unique Product Identifier)', 'Economic Operator Identifier', 'Verweis auf Daten-Host (DPP-Flash)'],
  },
  {
    id: 'eu-customs',
    title: 'Zoll · EU CSW-CERTEX / Nationales Single Window',
    subtitle: 'Maschinenlesbare Übergabe an ATLAS & EU-Zoll-Infrastruktur (Demo).',
    payloadHints: ['Zolltarifnummer (HS/CN)', 'DPP-Status & Pass-Referenz'],
  },
  {
    id: 'public-resolver',
    title: 'Public Resolver (QR auf dem Produkt)',
    subtitle: 'Dezentral gehostete Pass-Daten für Behörden, Werkstätten und Scanner.',
    payloadHints: ['HTTPS-Resolver-URL', 'QR-Ziel & Cache-Freigabe'],
  },
];

export type PublishManifest = {
  upi: string;
  economicOperatorId: string;
  dataHostUrl: string;
  customsTariff: string;
  dppStatus: string;
};

function fieldValue(draft: DraftPassport, key: string): string | null {
  const value = draft.passportFields?.[key]?.value?.trim();
  return value || null;
}

export function buildPublishManifest(draft: DraftPassport): PublishManifest {
  const passId = resolveDraftPublishPassId(draft);
  return {
    upi: fieldValue(draft, 'battery.uniqueId') ?? passId,
    economicOperatorId: fieldValue(draft, 'operator.responsibleOperatorId') ?? 'DE1234567890123',
    dataHostUrl: draft.publishedUrl ?? buildPublicDppPassportUrl(passId),
    customsTariff: fieldValue(draft, 'compliance.customsTariff') ?? '8507 60 00 00',
    dppStatus: 'ACTIVE · EU_BATTERY_REG_COMPLIANT',
  };
}

export type PreflightCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
};

export function buildPublishPreflightChecks(
  draft: DraftPassport,
  criticalOk: boolean,
): PreflightCheck[] {
  const manifest = buildPublishManifest(draft);
  return [
    {
      id: 'readiness',
      label: 'Pflichtfelder & Veröffentlichungsreife',
      ok: criticalOk,
      detail: criticalOk ? 'Alle kritischen Felder erfüllt' : 'Offene Pflichtfelder blockieren Publish',
    },
    {
      id: 'upi',
      label: 'Unique Product Identifier (UPI)',
      ok: Boolean(manifest.upi),
      detail: manifest.upi,
    },
    {
      id: 'operator',
      label: 'Economic Operator Identifier',
      ok: Boolean(manifest.economicOperatorId),
      detail: manifest.economicOperatorId,
    },
    {
      id: 'customs',
      label: 'Zolltarifnummer maschinenlesbar',
      ok: Boolean(manifest.customsTariff),
      detail: manifest.customsTariff,
    },
  ];
}

export function preflightReady(checks: readonly PreflightCheck[]): boolean {
  return checks.every((c) => c.ok);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Mock API latency with smooth progress ticks (Demo). */
export async function animateChannelProgress(
  onProgress: (percent: number) => void,
  durationMs = 1300,
): Promise<void> {
  const steps = 24;
  for (let step = 0; step <= steps; step += 1) {
    onProgress(Math.round((step / steps) * 100));
    await sleep(durationMs / steps);
  }
}
