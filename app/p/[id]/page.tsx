import { getProductById } from '../../lib/mock-data';
import { notFound } from 'next/navigation';
import { ShieldCheck, Battery, AlertTriangle } from 'lucide-react';
import type { EsprProductData } from '../../types/espr';

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

function Field({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between items-start gap-4 px-5 py-3">
      <dt className="text-sm text-gray-500 shrink-0 w-44">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 text-right">{String(value)}</dd>
    </div>
  );
}

function Pct({ label, value }: { label: string; value?: number }) {
  if (value === undefined) return null;
  return <Field label={label} value={`${value} %`} />;
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
  let raw = await getProductById(id) as any;

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

  // Map to EsprProductData — handles both new schema and legacy BatteryDPP
  const p: EsprProductData = {
    id:        raw.id,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : (raw.createdAt ?? new Date().toISOString()),
    language:  raw.language ?? 'de',
    type:      raw.type ?? 'BATTERY',

    manufacturer:  raw.manufacturer ?? { name: raw.hersteller ?? '' },
    hersteller:    raw.hersteller   ?? raw.manufacturer?.name ?? '',
    model:         raw.model        ?? raw.modellname         ?? '',
    modellname:    raw.modellname   ?? raw.model              ?? '',

    serialNumber:   raw.serialNumber   ?? raw.seriennummer,
    batchNumber:    raw.batchNumber,
    productionDate: raw.productionDate ?? raw.produktionsdatum,

    capacityKwh:    raw.capacityKwh    ?? raw.kapazitaetKWh,
    chemistry:      raw.chemistry      ?? raw.chemischesSystem,
    batteryType:    raw.batteryType    ?? raw.batterietyp,
    nominalVoltageV: raw.nominalVoltageV ?? raw.nennspannungV,
    weightKg:       raw.weightKg       ?? raw.gewichtKg,

    carbonFootprint: raw.carbonFootprint ?? {
      totalKg:   raw.co2FussabdruckKgGesamt,
      perKwhKg:  raw.co2FussabdruckKgProKwh,
    },

    recycledContent: raw.recycledContent ?? {
      cobaltPct:  raw.recyclinganteilKobalt,
      lithiumPct: raw.recyclinganteilLithium,
      nickelPct:  raw.recyclinganteilNickel,
    },

    lifecycle: raw.lifecycle ?? {
      expectedCycles:          raw.erwarteteLebensdauerLadezyklen,
      repairabilityScore:      raw.reparierbarkeitsIndex,
      sparePartsAvailableYears: raw.ersatzteileVerfuegbarkeitJahre,
    },

    endOfLife: raw.endOfLife ?? {
      recyclingInstructions: raw.recyclingAnweisungen,
    },

    certificationBody:   raw.certificationBody   ?? raw.zertifizierungsstelle,
    regulatoryReference: raw.regulatoryReference ?? raw.referenznummer,
    legalNotes:          raw.legalNotes          ?? raw.rechtlicheHinweise,

    extractionConfidence: raw.extractionConfidence ?? 1,
    extractionWarnings:   raw.extractionWarnings   ?? [],
  };

  const hasWarnings = p.extractionWarnings.length > 0;
  const expiryYear = new Date(p.createdAt).getFullYear() + 15;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">

      {/* ── Page header ── */}
      <header className="bg-white border-b px-4 py-7 text-center shadow-sm">
        <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
          <ShieldCheck size={14} /> EU-Konform · ESPR 2024/1781
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
          Digitaler Produktpass
        </h1>
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

      <main className="max-w-2xl mx-auto px-4 mt-6 space-y-4">

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

        {/* ── Identity ── */}
        <Section title="Allgemeine Informationen">
          <Field label="Hersteller"        value={p.manufacturer.name || p.hersteller} />
          <Field label="Adresse"           value={p.manufacturer.address} />
          <Field label="Land"              value={p.manufacturer.country} />
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
