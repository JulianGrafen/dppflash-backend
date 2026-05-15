import { getProductById } from '../../lib/mock-data';
import { notFound } from 'next/navigation';
import { ShieldCheck, Battery, AlertTriangle } from 'lucide-react';
import type { EsprProductData } from '../../types/espr';
import { coerceMaterialCompositionArray } from '@/app/domain/dpp/materialCompositionToSankey';
import { RagProvenanceSection } from './RagProvenanceSection';
import { TraceabilitySection } from './TraceabilitySection';

// ─── Page contract ────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ d?: string }>;
}

// ─── Presentational helpers ───────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 px-5 py-3 border-b border-gray-50 bg-gray-50">
        {title}
      </h2>
      <dl className="divide-y divide-gray-50">{children}</dl>
    </section>
  );
}

function Field({
  label,
  value,
  sourceBadge,
}: {
  label: string;
  value?: string | number;
  /** Short provenance label, e.g. RAG from indexed PDF */
  sourceBadge?: string;
}) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between items-start gap-4 px-5 py-3">
      <dt className="text-sm text-gray-500 shrink-0 w-44">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 text-right">
        <span>{String(value)}</span>
        {sourceBadge ? (
          <span
            className="ml-2 inline-flex align-middle rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-800"
            title="Aus dem hochgeladenen Dokument (RAG-Index) übernommen"
          >
            {sourceBadge}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function ReviewField({
  label,
  value,
  highlighted,
  sourceBadge,
}: {
  label: string;
  value?: string | number;
  highlighted: boolean;
  sourceBadge?: string;
}) {
  if (!highlighted) {
    return <Field label={label} value={value} sourceBadge={sourceBadge} />;
  }

  if (value === undefined || value === null || value === '') return null;

  return (
    <div className="flex justify-between items-start gap-4 px-5 py-3 bg-yellow-50 border-l-4 border-yellow-300">
      <dt className="text-sm text-yellow-700 shrink-0 w-44">{label}</dt>
      <dd className="text-sm font-semibold text-yellow-900 text-right">
        <span>{String(value)}</span>
        {sourceBadge ? (
          <span
            className="ml-2 inline-flex align-middle rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-800"
            title="Aus dem hochgeladenen Dokument (RAG-Index) übernommen"
          >
            {sourceBadge}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function Pct({ label, value }: { label: string; value?: number }) {
  if (value === undefined) return null;
  return <Field label={label} value={`${value} %`} />;
}

function formatPercentage(value: unknown): string | undefined {
  if (typeof value !== 'number') {
    return undefined;
  }

  return `${value} %`;
}

type KeyValueEntry = { readonly title: string; readonly details?: string };

function compactEntries(entries: Array<KeyValueEntry | null>): KeyValueEntry[] {
  return entries.flatMap((entry) => entry ? [entry] : []);
}

function renderKeyValueList(
  label: string,
  entries: readonly KeyValueEntry[],
) {
  if (entries.length === 0) return null;

  return (
    <div className="flex justify-between items-start gap-4 px-5 py-3">
      <dt className="text-sm text-gray-500 shrink-0 w-44">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 text-right space-y-1">
        {entries.map((entry) => (
          <div key={`${label}-${entry.title}-${entry.details ?? ''}`}>
            <div>{entry.title}</div>
            {entry.details ? (
              <div className="text-xs text-gray-500">{entry.details}</div>
            ) : null}
          </div>
        ))}
      </dd>
    </div>
  );
}

function pickMaterialCompositionPercent(entry: Record<string, unknown>): number | undefined {
  for (const k of ['percentage', 'sharePercent', 'anteil', 'percent', 'massPercent', 'share', 'concentrationPercent'] as const) {
    if (!(k in entry)) continue;
    const v = entry[k];
    if (typeof v === 'number' && Number.isFinite(v)) {
      return v;
    }
    if (typeof v === 'string' && v.trim()) {
      const t = v.trim().replace(/\s+/g, '').replace(',', '.');
      const n = Number(t.endsWith('%') ? t.slice(0, -1) : t);
      if (Number.isFinite(n)) {
        return n;
      }
    }
  }
  return undefined;
}

function materialNameFromCompositionEntry(entry: Record<string, unknown>): string | undefined {
  for (const k of ['material', 'name', 'bezeichnung', 'materialName', 'component', 'substance', 'title'] as const) {
    const v = entry[k];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return undefined;
}

function unwrapProvenanceInner(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
    return (value as Record<string, unknown>).value;
  }
  return value;
}

/** ESPR Kernfeld materialComposition + legacy Textfeld materialZusammensetzung (z. B. Textilien). */
function renderMaterialZusammensetzungKernfelder(
  materialComposition: unknown,
  materialZusammensetzung: unknown,
) {
  const entries: KeyValueEntry[] = [];
  const compositionItems = coerceMaterialCompositionArray(materialComposition);
  for (const item of compositionItems) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const title = materialNameFromCompositionEntry(row);
    if (!title) continue;
    const pct = pickMaterialCompositionPercent(row);
    entries.push({
      title,
      details: pct !== undefined ? formatPercentage(pct) : undefined,
    });
  }

  const mzInner = unwrapProvenanceInner(materialZusammensetzung);
  if (Array.isArray(mzInner)) {
    for (const item of mzInner) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const title =
        typeof row.stoffname === 'string'
          ? row.stoffname.trim()
          : typeof row.substance === 'string'
            ? row.substance.trim()
            : '';
      if (!title) continue;
      const pct =
        typeof row.prozentAnteil === 'string' && row.prozentAnteil.trim()
          ? row.prozentAnteil.trim()
          : undefined;
      const ein =
        typeof row.einstufung === 'string' && row.einstufung.trim()
          ? row.einstufung.trim()
          : undefined;
      const cas =
        row.casNummer !== null && typeof row.casNummer === 'string' && row.casNummer.trim()
          ? row.casNummer.trim()
          : typeof row.casNumber === 'string'
            ? row.casNumber.trim()
            : undefined;
      const details = [pct, cas ? `CAS ${cas}` : undefined, ein].filter(Boolean).join(' · ');
      entries.push({ title, details: details || undefined });
    }
  }

  const legacy =
    typeof materialZusammensetzung === 'string' && materialZusammensetzung.trim().length > 0
      ? materialZusammensetzung.trim()
      : typeof mzInner === 'string' && mzInner.trim().length > 0
        ? mzInner.trim()
        : undefined;

  const list = renderKeyValueList('Material-Zusammensetzung', entries);
  if (list) {
    return (
      <>
        {list}
        {legacy && entries.length > 0 ? (
          <Field label="Material-Zusammensetzung (Text)" value={legacy} />
        ) : null}
      </>
    );
  }

  if (legacy) {
    return <Field label="Material-Zusammensetzung" value={legacy} />;
  }

  return null;
}

function renderRecycledContent(value: unknown) {
  if (!Array.isArray(value)) return null;

  const entries = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];

    const material = 'material' in entry && typeof entry.material === 'string'
      ? entry.material
      : undefined;
    const percentage = 'percentage' in entry ? formatPercentage(entry.percentage) : undefined;

    if (!material) return [];

    return [{
      title: material,
      details: percentage,
    }];
  });

  return renderKeyValueList('Rezyklatanteil', entries);
}

function renderCarbonFootprint(value: unknown) {
  if (!value || typeof value !== 'object') return null;

  const entries = compactEntries([
    'valueKgCo2e' in value && typeof value.valueKgCo2e === 'number'
      ? { title: `${value.valueKgCo2e} kg CO₂e` }
      : null,
    'lifecycleStage' in value && typeof value.lifecycleStage === 'string' && value.lifecycleStage
      ? { title: 'Lebenszyklusphase', details: value.lifecycleStage }
      : null,
    'calculationMethod' in value && typeof value.calculationMethod === 'string' && value.calculationMethod
      ? { title: 'Berechnungsmethode', details: value.calculationMethod }
      : null,
  ]);

  return renderKeyValueList('CO₂-Fußabdruck', entries);
}

function renderSubstancesOfConcern(value: unknown) {
  const inner = unwrapProvenanceInner(value);
  if (!Array.isArray(inner)) return null;

  const entries = inner.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];

    const name =
      ('name' in entry && typeof entry.name === 'string' ? entry.name : undefined)
      ?? ('stoffname' in entry && typeof entry.stoffname === 'string' ? entry.stoffname : undefined);
    const casNumber =
      ('casNumber' in entry && typeof entry.casNumber === 'string' ? entry.casNumber : undefined)
      ?? ('casNummer' in entry && entry.casNummer !== null && typeof entry.casNummer === 'string'
        ? entry.casNummer
        : undefined);
    const concentration =
      'concentrationPercent' in entry ? formatPercentage(entry.concentrationPercent) : undefined;
    const pctStr =
      'anteilOderGrenzwert' in entry && typeof entry.anteilOderGrenzwert === 'string'
      && entry.anteilOderGrenzwert.trim()
        ? entry.anteilOderGrenzwert.trim()
        : undefined;
    const hazardClass =
      ('hazardClass' in entry && typeof entry.hazardClass === 'string' && entry.hazardClass
        ? entry.hazardClass
        : undefined)
      ?? ('hinweis' in entry && typeof entry.hinweis === 'string' && entry.hinweis.trim()
        ? entry.hinweis.trim()
        : undefined);

    if (!name) return [];

    const details = [casNumber, pctStr ?? concentration, hazardClass].filter(Boolean).join(' · ');

    return [{
      title: name,
      details: details || undefined,
    }];
  });

  return renderKeyValueList('Besorgniserregende Stoffe', entries);
}

function renderGefahrenstoffeKernfelder(value: unknown) {
  const inner = unwrapProvenanceInner(value);
  if (inner === undefined || inner === null) return null;
  if (!Array.isArray(inner) || inner.length === 0) return null;

  if (typeof inner[0] === 'string') {
    return renderKeyValueList(
      'Gefahren- / besorgniserregende Stoffe',
      inner.map((s) => ({ title: typeof s === 'string' ? s : String(s) })),
    );
  }

  const entries = inner.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const o = entry as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!name) return [];
    const parts = [
      o.casNummer != null && String(o.casNummer).trim() ? `CAS ${String(o.casNummer).trim()}` : '',
      o.anteilOderGrenzwert != null && String(o.anteilOderGrenzwert).trim()
        ? String(o.anteilOderGrenzwert).trim()
        : '',
      o.hinweis != null && String(o.hinweis).trim() ? String(o.hinweis).trim() : '',
    ].filter(Boolean);
    return [{ title: name, details: parts.join(' · ') || undefined }];
  });

  return renderKeyValueList('Gefahren- / besorgniserregende Stoffe', entries);
}

function renderManufacturerDetails(value: unknown) {
  if (!value || typeof value !== 'object') return null;

  const entries = compactEntries([
    'name' in value && typeof value.name === 'string' && value.name
      ? { title: value.name }
      : null,
    'address' in value && typeof value.address === 'string' && value.address
      ? { title: 'Adresse', details: value.address }
      : null,
    'country' in value && typeof value.country === 'string' && value.country
      ? { title: 'Land', details: value.country }
      : null,
  ]);

  return renderKeyValueList('Herstellerdetails', entries);
}

function renderSupplierAndProcessInformation(value: unknown) {
  if (!Array.isArray(value)) return null;

  const entries = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];

    const level = 'level' in entry && typeof entry.level === 'string' ? entry.level : undefined;
    const supplierName = 'supplierName' in entry && typeof entry.supplierName === 'string'
      ? entry.supplierName
      : undefined;
    const supplierCountry = 'supplierCountry' in entry && typeof entry.supplierCountry === 'string'
      ? entry.supplierCountry
      : undefined;
    const processName = 'processName' in entry && typeof entry.processName === 'string'
      ? entry.processName
      : undefined;
    const processDescription = 'processDescription' in entry && typeof entry.processDescription === 'string'
      ? entry.processDescription
      : undefined;

    if (!level && !supplierName && !processName) return [];

    const title = [level, supplierName, processName].filter(Boolean).join(' · ');
    const details = [supplierCountry, processDescription].filter(Boolean).join(' · ');

    return [{
      title,
      details: details || undefined,
    }];
  });

  return renderKeyValueList('Lieferanten- & Prozessinfos', entries);
}

function renderCareRepairDurability(value: unknown) {
  if (!value || typeof value !== 'object') return null;

  const entries = compactEntries([
    'careInstructions' in value && typeof value.careInstructions === 'string' && value.careInstructions
      ? { title: 'Pflegehinweise', details: value.careInstructions }
      : null,
    'repairInstructions' in value && typeof value.repairInstructions === 'string' && value.repairInstructions
      ? { title: 'Reparaturhinweise', details: value.repairInstructions }
      : null,
    'durabilityGuidance' in value && typeof value.durabilityGuidance === 'string' && value.durabilityGuidance
      ? { title: 'Haltbarkeit', details: value.durabilityGuidance }
      : null,
  ]);

  return renderKeyValueList('Pflege, Reparatur & Haltbarkeit', entries);
}

function renderChemicalComposition(value: unknown) {
  const inner = unwrapProvenanceInner(value);
  if (!Array.isArray(inner)) return null;

  const entries = inner.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];

    const substance =
      ('substance' in entry && typeof entry.substance === 'string' ? entry.substance.trim() : '')
      || ('stoffname' in entry && typeof entry.stoffname === 'string' ? entry.stoffname.trim() : '')
      || undefined;

    const casNumber =
      ('casNumber' in entry && typeof entry.casNumber === 'string' ? entry.casNumber : undefined)
      ?? ('casNummer' in entry && entry.casNummer !== null && typeof entry.casNummer === 'string'
        ? entry.casNummer
        : undefined);

    const pctFromStructured =
      'prozentAnteil' in entry && typeof entry.prozentAnteil === 'string' && entry.prozentAnteil.trim()
        ? entry.prozentAnteil.trim()
        : undefined;
    const concentration = 'concentrationPercent' in entry ? formatPercentage(entry.concentrationPercent) : undefined;

    const substanceFunction =
      ('function' in entry && typeof entry.function === 'string' && entry.function.trim()
        ? entry.function.trim()
        : undefined)
      ?? ('einstufung' in entry && entry.einstufung !== null && typeof entry.einstufung === 'string'
        ? entry.einstufung.trim()
        : undefined);

    if (!substance) return [];

    const details = [casNumber, pctFromStructured ?? concentration, substanceFunction].filter(Boolean).join(' · ');

    return [{
      title: substance,
      details: details || undefined,
    }];
  });

  return renderKeyValueList('Chemische Zusammensetzung', entries);
}

function renderEnvironmentalImpact(value: unknown) {
  if (!value || typeof value !== 'object') return null;

  const entries = compactEntries([
    'waterFootprintLiters' in value && typeof value.waterFootprintLiters === 'number'
      ? { title: 'Wasserfußabdruck', details: `${value.waterFootprintLiters} l` }
      : null,
    'impactNotes' in value && typeof value.impactNotes === 'string' && value.impactNotes
      ? { title: 'Umwelthinweise', details: value.impactNotes }
      : null,
  ]);

  return renderKeyValueList('Umweltwirkung', entries);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function readDisplayProductName(raw: Record<string, unknown>, p: EsprProductData): string {
  const candidateValues = [
    raw.productName,
    raw.modellname,
    raw.model,
    p.modellname,
    p.model,
  ];

  for (const candidate of candidateValues) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return 'Digitaler Produktpass';
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 75 ? 'bg-green-100 text-green-700' :
    pct >= 50 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
      {pct} % Konfidenz
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProductPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { d } = await searchParams;

  // Primary: store lookup
  let raw: Record<string, unknown> | undefined = await getProductById(id) as unknown as Record<string, unknown> | undefined;

  // Fallback: product data encoded in QR URL (?d=…)
  if (!raw && d) {
    try {
      const decoded = JSON.parse(decodeURIComponent(d));
      if (decoded?.id && decoded?.type) raw = decoded;
    } catch {
      console.warn('[ProductPage] URL-Dekodierung fehlgeschlagen');
    }
  }

  if (!raw) return notFound();

  const manufacturer = asRecord(raw.manufacturer);
  const carbonFootprint = asRecord(raw.carbonFootprint);
  const recycledContent = asRecord(raw.recycledContent);
  const lifecycle = asRecord(raw.lifecycle);
  const endOfLife = asRecord(raw.endOfLife);
  const productType = asString(raw.type) as EsprProductData['type'] | undefined;

  // Map to EsprProductData — handles both new schema and legacy BatteryDPP
  const p: EsprProductData = {
    id:        asString(raw.id) ?? id,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : (asString(raw.createdAt) ?? new Date().toISOString()),
    language:  asString(raw.language) ?? 'de',
    type:      productType ?? 'BATTERY',

    manufacturer: manufacturer
      ? {
          name: asString(manufacturer.name) ?? asString(raw.hersteller) ?? '',
          address: asString(manufacturer.address),
          country: asString(manufacturer.country),
        }
      : { name: asString(raw.hersteller) ?? '' },
    hersteller:    asString(raw.hersteller)   ?? asString(manufacturer?.name) ?? '',
    model:         asString(raw.model)        ?? asString(raw.modellname) ?? '',
    modellname:    asString(raw.modellname)   ?? asString(raw.model) ?? '',

    serialNumber:   asString(raw.serialNumber)   ?? asString(raw.seriennummer),
    batchNumber:    asString(raw.batchNumber),
    productionDate: asString(raw.productionDate) ?? asString(raw.produktionsdatum),

    capacityKwh:    asNumber(raw.capacityKwh)    ?? asNumber(raw.kapazitaetKWh),
    chemistry:      asString(raw.chemistry)      ?? asString(raw.chemischesSystem),
    batteryType:    asString(raw.batteryType)    ?? asString(raw.batterietyp),
    nominalVoltageV: asNumber(raw.nominalVoltageV) ?? asNumber(raw.nennspannungV),
    weightKg:       asNumber(raw.weightKg)       ?? asNumber(raw.gewichtKg),

    carbonFootprint: carbonFootprint ? {
      totalKg:   asNumber(carbonFootprint.totalKg) ?? asNumber(raw.co2FussabdruckKgGesamt),
      perKwhKg:  asNumber(carbonFootprint.perKwhKg) ?? asNumber(raw.co2FussabdruckKgProKwh),
      methodology: asString(carbonFootprint.methodology),
      certificationBody: asString(carbonFootprint.certificationBody),
    } : {
      totalKg:   asNumber(raw.co2FussabdruckKgGesamt),
      perKwhKg:  asNumber(raw.co2FussabdruckKgProKwh),
    },

    recycledContent: recycledContent ? {
      cobaltPct:  asNumber(recycledContent.cobaltPct) ?? asNumber(raw.recyclinganteilKobalt),
      lithiumPct: asNumber(recycledContent.lithiumPct) ?? asNumber(raw.recyclinganteilLithium),
      nickelPct:  asNumber(recycledContent.nickelPct) ?? asNumber(raw.recyclinganteilNickel),
      leadPct: asNumber(recycledContent.leadPct),
    } : {
      cobaltPct:  asNumber(raw.recyclinganteilKobalt),
      lithiumPct: asNumber(raw.recyclinganteilLithium),
      nickelPct:  asNumber(raw.recyclinganteilNickel),
    },

    lifecycle: lifecycle ? {
      expectedCycles:          asNumber(lifecycle.expectedCycles) ?? asNumber(raw.erwarteteLebensdauerLadezyklen),
      repairabilityScore:      asNumber(lifecycle.repairabilityScore) ?? asNumber(raw.reparierbarkeitsIndex),
      sparePartsAvailableYears: asNumber(lifecycle.sparePartsAvailableYears) ?? asNumber(raw.ersatzteileVerfuegbarkeitJahre),
      warrantyYears: asNumber(lifecycle.warrantyYears),
    } : {
      expectedCycles:          asNumber(raw.erwarteteLebensdauerLadezyklen),
      repairabilityScore:      asNumber(raw.reparierbarkeitsIndex),
      sparePartsAvailableYears: asNumber(raw.ersatzteileVerfuegbarkeitJahre),
    },

    endOfLife: endOfLife ? {
      recyclingInstructions: asString(endOfLife.recyclingInstructions) ?? asString(raw.recyclingAnweisungen),
      disposalInstructions:
        asString(endOfLife.disposalInstructions)
        ?? asString(raw.endOfLifeInstructions)
        ?? asString(raw.entsorgungshinweise),
      hazardousSubstances: asStringArray(endOfLife.hazardousSubstances),
    } : {
      recyclingInstructions: asString(raw.recyclingAnweisungen),
      disposalInstructions:
        asString(raw.endOfLifeInstructions)
        ?? asString(raw.entsorgungshinweise),
    },

    certificationBody:   asString(raw.certificationBody)   ?? asString(raw.zertifizierungsstelle),
    regulatoryReference: asString(raw.regulatoryReference) ?? asString(raw.referenznummer),
    legalNotes:          asString(raw.legalNotes)          ?? asString(raw.rechtlicheHinweise),

    extractionConfidence: asNumber(raw.extractionConfidence) ?? 1,
    extractionWarnings:   asStringArray(raw.extractionWarnings),
  };

  const hasWarnings = p.extractionWarnings.length > 0;
  const expiryYear = new Date(p.createdAt).getFullYear() + 15;
  const displayProductName = readDisplayProductName(raw, p);
  const enrichmentReview = asRecord(raw.enrichmentReview);
  const enrichmentFields = asStringArray(enrichmentReview?.enrichedFields);
  const enrichmentSources = asStringArray(enrichmentReview?.sourceUrls);
  const ragSuppliedFields = asStringArray(raw.ragSuppliedFieldKeys);
  const isReviewRequired = asString(raw.complianceStatus) === 'REVIEW_REQUIRED'
    || asString(enrichmentReview?.status) === 'PENDING';

  return (
    <div className="min-h-screen bg-gray-50 pb-16">

      {/* ── Page header ── */}
      <header className="bg-white border-b px-4 py-7 text-center shadow-sm">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${
          isReviewRequired ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
        }`}>
          <ShieldCheck size={14} /> {isReviewRequired ? 'Review erforderlich' : 'EU-Konform'} · ESPR 2024/1781
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">{displayProductName}</h1>
        <p className="text-gray-500 text-sm mt-1">Digitaler Produktpass</p>
        <p className="text-gray-400 text-xs mt-2">
          <code className="bg-gray-100 px-2 py-1 rounded">{p.id}</code>
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-base font-bold text-blue-600">
            <Battery size={18} />
            {p.hersteller || '—'} · {p.modellname || '—'}
          </span>
        </div>
        <div className="mt-2">
          <ConfidenceBadge score={p.extractionConfidence} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-4">

        {/* ── Extraction warnings ── */}
        {hasWarnings && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
            <div className="flex items-start gap-2 text-amber-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold mb-1">Hinweise zur Datenqualität</p>
                <ul className="text-sm space-y-0.5">
                  {p.extractionWarnings.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {isReviewRequired && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-yellow-800">
              Enrichment-Werte wurden automatisch aus Web-Quellen ergänzt. Bitte prüfen und bestätigen.
            </p>
            {enrichmentSources.length > 0 ? (
              <ul className="text-sm text-yellow-900 space-y-1">
                {enrichmentSources.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer" className="underline hover:no-underline">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            <form action="/api/products/validate" method="post">
              <input type="hidden" name="productId" value={p.id} />
              <input type="hidden" name="returnUrl" value={`/p/${p.id}`} />
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-yellow-600 px-3 py-2 text-sm font-semibold text-white hover:bg-yellow-700"
              >
                Daten validieren
              </button>
            </form>
          </div>
        )}

        {/* ── Identity ── */}
        <Section title="Allgemeine Informationen">
          <Field label="Hersteller"        value={p.manufacturer.name || p.hersteller} />
          <Field label="Adresse"           value={p.manufacturer.address} />
          <Field label="Land"              value={p.manufacturer.country} />
          <ReviewField
            label="Ursprungsland"
            value={typeof raw.countryOfOrigin === 'string' ? raw.countryOfOrigin : undefined}
            highlighted={enrichmentFields.includes('countryOfOrigin')}
          />
          <Field label="Herstellungsland"  value={typeof raw.countryOfManufacturing === 'string' ? raw.countryOfManufacturing : undefined} />
          <Field label="Modell"            value={p.modellname} />
          <Field label="Seriennummer"      value={p.serialNumber} />
          <Field label="Chargennummer"     value={p.batchNumber} />
          <Field label="Herstellungsdatum" value={p.productionDate} />
          <Field label="Erstellt am"       value={new Date(p.createdAt).toLocaleDateString('de-DE')} />
        </Section>

        {/* ── Technical spec ── */}
        <Section title="Technische Spezifikation">
          <Field label="Kapazität"       value={p.capacityKwh !== undefined ? `${p.capacityKwh} kWh` : undefined} />
          <Field label="Chemisches System" value={p.chemistry} />
          <Field label="Batterietyp"     value={p.batteryType} />
          <Field label="Nennspannung"    value={p.nominalVoltageV !== undefined ? `${p.nominalVoltageV} V` : undefined} />
          <Field label="Gewicht"         value={p.weightKg !== undefined ? `${p.weightKg} kg` : undefined} />
        </Section>

        <TraceabilitySection raw={raw as Record<string, unknown>} productDisplayName={displayProductName} />

        {/* ── DPP Core fields (new extraction schema) ── */}
        <Section title="DPP-Kernfelder (ESPR)">
          <Field label="Produktname" value={typeof raw.productName === 'string' ? raw.productName : undefined} />
          <Field label="Abfallschluessel (EAK)" value={typeof raw.wasteCode === 'string' ? raw.wasteCode : undefined} />
          <Field label="UPI" value={typeof raw.upi === 'string' ? raw.upi : undefined} />
          <ReviewField
            label="GTIN"
            value={typeof raw.gtin === 'string' ? raw.gtin : undefined}
            highlighted={enrichmentFields.includes('gtin')}
            sourceBadge={ragSuppliedFields.includes('gtin') ? 'RAG' : undefined}
          />
          {renderManufacturerDetails(raw.manufacturer)}
          {renderMaterialZusammensetzungKernfelder(raw.materialComposition, raw.materialZusammensetzung)}
          {renderChemicalComposition(raw.chemicalComposition)}
          {renderRecycledContent(raw.recycledContent)}
          {renderCarbonFootprint(raw.carbonFootprint)}
          {renderEnvironmentalImpact(raw.environmentalImpact)}
          {renderSubstancesOfConcern(raw.substancesOfConcern)}
          {renderGefahrenstoffeKernfelder(raw.gefahrenstoffe)}
          {renderSupplierAndProcessInformation(raw.supplierAndProcessInformation)}
          {renderCareRepairDurability(raw.careRepairDurability)}
          <Field
            label="End-of-Life-Hinweise"
            value={
              typeof raw.endOfLifeInstructions === 'string'
                ? raw.endOfLifeInstructions
                : typeof raw.entsorgungshinweise === 'string'
                  ? raw.entsorgungshinweise
                  : undefined
            }
          />
        </Section>

        <RagProvenanceSection ragEnrichment={raw.ragEnrichment} />

        {/* ── Carbon footprint (Art. 7) ── */}
        <Section title="CO₂-Fußabdruck (Art. 7 EU 2023/1542)">
          <Field label="Gesamt (kg CO₂e)"   value={p.carbonFootprint.totalKg} />
          <Field label="Pro kWh (kg CO₂e)"  value={p.carbonFootprint.perKwhKg} />
          <Field label="Methodik"            value={p.carbonFootprint.methodology} />
          <Field label="Zertifizierer"       value={p.carbonFootprint.certificationBody} />
        </Section>

        {/* ── Recycled content (Art. 8) ── */}
        <Section title="Recyclinganteil (Art. 8 EU 2023/1542)">
          <Pct label="Kobalt"   value={p.recycledContent.cobaltPct} />
          <Pct label="Lithium"  value={p.recycledContent.lithiumPct} />
          <Pct label="Nickel"   value={p.recycledContent.nickelPct} />
          <Pct label="Blei"     value={p.recycledContent.leadPct} />
        </Section>

        {/* ── Lifecycle (Art. 10) ── */}
        <Section title="Lebensdauer & Reparierbarkeit (Art. 10)">
          <Field label="Erwartete Ladezyklen"  value={p.lifecycle.expectedCycles} />
          <Field label="Reparierbarkeitsindex" value={p.lifecycle.repairabilityScore !== undefined ? `${p.lifecycle.repairabilityScore} / 10` : undefined} />
          <Field label="Ersatzteil-Verfügbarkeit" value={p.lifecycle.sparePartsAvailableYears !== undefined ? `${p.lifecycle.sparePartsAvailableYears} Jahre` : undefined} />
          <Field label="Garantie"              value={p.lifecycle.warrantyYears !== undefined ? `${p.lifecycle.warrantyYears} Jahre` : undefined} />
        </Section>

        {/* ── End-of-life (Art. 11) ── */}
        <Section title="Entsorgung & Recycling (Art. 11)">
          <Field label="Recyclinganweisungen"  value={p.endOfLife.recyclingInstructions} />
          <Field label="Entsorgungshinweise"   value={p.endOfLife.disposalInstructions} />
          {p.endOfLife.hazardousSubstances?.length ? (
            <Field label="Gefahrstoffe" value={p.endOfLife.hazardousSubstances.join(', ')} />
          ) : null}
        </Section>

        {/* ── Regulatory ── */}
        <Section title="Zertifizierung & Compliance">
          <Field label="Zertifizierungsstelle" value={p.certificationBody} />
          <Field label="Rechtsgrundlage"        value={p.regulatoryReference} />
          <Field label="Rechtliche Hinweise"    value={p.legalNotes} />
          <Field label="Lieferkette"            value={p.supplyChainInfo} />
        </Section>

      </main>

      {/* ── Footer ── */}
      <footer className="mt-12 text-center text-gray-400 text-xs px-6 space-y-1">
        <p>Datenverfügbarkeit garantiert bis {expiryYear} gemäß EU-Verordnung.</p>
        <p>100 % lokal verarbeitet · DSGVO-konform</p>
      </footer>
    </div>
  );
}
