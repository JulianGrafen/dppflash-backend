export type StammdatenFieldDef = {
  key: 'hersteller' | 'herstelleradresse' | 'eori';
  label: string;
  placeholder: string;
  multiline?: boolean;
};

export const STAMMDATEN_FIELD_DEFS: StammdatenFieldDef[] = [
  {
    key: 'hersteller',
    label: 'Hersteller',
    placeholder: 'z. B. TechVolt GmbH',
  },
  {
    key: 'herstelleradresse',
    label: 'Herstelleradresse',
    placeholder: 'Straße, PLZ Ort, Land',
    multiline: true,
  },
  {
    key: 'eori',
    label: 'EORI',
    placeholder: 'EORI-Nummer des Wirtschaftsbeteiligten',
  },
];

export type StammdatenFormState = {
  hersteller: string;
  herstelleradresse: string;
  eori: string;
  kontaktName: string;
  kontaktEmail: string;
  kontaktPhone: string;
};

export const EMPTY_STAMMDATEN_FORM: StammdatenFormState = {
  hersteller: '',
  herstelleradresse: '',
  eori: '',
  kontaktName: '',
  kontaktEmail: '',
  kontaktPhone: '',
};

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

const DRAFT_STAMMDATEN_KEYS = [
  { key: 'hersteller', label: 'Hersteller' },
  { key: 'herstelleradresse', label: 'Herstelleradresse' },
  { key: 'kontakt', label: 'Kontakt' },
  { key: 'eori', label: 'EORI' },
] as const;

export function stammdatenFromApiRecord(
  record: Record<string, unknown> | null | undefined,
): StammdatenFormState {
  if (!record) {
    return { ...EMPTY_STAMMDATEN_FORM };
  }
  const kontakt =
    record.kontakt && typeof record.kontakt === 'object'
      ? (record.kontakt as ContactPayload)
      : {};
  return {
    hersteller: String(record.hersteller ?? ''),
    herstelleradresse: String(record.herstelleradresse ?? ''),
    eori: String(record.eori ?? ''),
    kontaktName: String(kontakt.name ?? ''),
    kontaktEmail: String(kontakt.email ?? ''),
    kontaktPhone: String(kontakt.phone ?? ''),
  };
}

export function stammdatenFormToApiPayload(form: StammdatenFormState): Record<string, unknown> {
  const kontakt =
    form.kontaktName.trim() || form.kontaktEmail.trim() || form.kontaktPhone.trim()
      ? {
          name: form.kontaktName.trim() || null,
          email: form.kontaktEmail.trim() || null,
          phone: form.kontaktPhone.trim() || null,
        }
      : null;
  return {
    hersteller: form.hersteller.trim() || null,
    herstelleradresse: form.herstelleradresse.trim() || null,
    eori: form.eori.trim() || null,
    kontakt,
  };
}

export function buildStammdatenRows(payload: Record<string, unknown>): StammdatenRow[] {
  const normalized = { ...payload };
  if (!normalized.herstelleradresse && normalized.manufacturer_address) {
    normalized.herstelleradresse = normalized.manufacturer_address;
  }

  return DRAFT_STAMMDATEN_KEYS.map((field) => {
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
