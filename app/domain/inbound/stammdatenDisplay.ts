export type StammdatenFieldDef = {
  key: string;
  label: string;
  excelColumns: string;
};

export const STAMMDATEN_FIELD_DEFS: StammdatenFieldDef[] = [
  {
    key: 'hersteller',
    label: 'Hersteller',
    excelColumns: 'Hersteller, Herstellername, Manufacturer, Lieferant',
  },
  {
    key: 'herstelleradresse',
    label: 'Herstelleradresse',
    excelColumns: 'Herstelleradresse, Adresse, Manufacturer Address, Anschrift',
  },
  {
    key: 'kontakt',
    label: 'Kontakt',
    excelColumns: 'Kontakt, Ansprechpartner + E-Mail + Telefon (separate Spalten)',
  },
  {
    key: 'eori',
    label: 'EORI',
    excelColumns: 'EORI, EORI-Nummer, EORI Number',
  },
];

export type StammdatenRow = {
  key: string;
  label: string;
  value: string | null;
  filled: boolean;
};

type ContactPayload = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

function formatKontakt(kontakt: unknown): string | null {
  if (!kontakt || typeof kontakt !== 'object') {
    return null;
  }
  const row = kontakt as ContactPayload;
  const parts = [row.name, row.email, row.phone]
    .map((part) => (part ? String(part).trim() : ''))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function formatPayloadValue(key: string, payload: Record<string, unknown>): string | null {
  const raw = payload[key];
  if (key === 'kontakt') {
    return formatKontakt(raw);
  }
  if (raw === null || raw === undefined) {
    return null;
  }
  const text = String(raw).trim();
  return text || null;
}

export function buildStammdatenRows(payload: Record<string, unknown>): StammdatenRow[] {
  const normalized = { ...payload };
  if (!normalized.herstelleradresse && normalized.manufacturer_address) {
    normalized.herstelleradresse = normalized.manufacturer_address;
  }

  return STAMMDATEN_FIELD_DEFS.map((field) => {
    const value = formatPayloadValue(field.key, normalized);
    return {
      key: field.key,
      label: field.label,
      value,
      filled: value !== null,
    };
  });
}

export function countFilledStammdaten(payload: Record<string, unknown>): { filled: number; total: number } {
  const rows = buildStammdatenRows(payload);
  const filled = rows.filter((row) => row.filled).length;
  return { filled, total: rows.length };
}
