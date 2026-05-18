import { z } from 'zod';

/**
 * Loose LLM shapes: comma/semicolon lists, stray spaces, bilingual keys.
 */
function coerceOptionalStringListForZod(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (Array.isArray(raw)) {
    const xs = raw.map((x) => String(x).trim()).filter(Boolean);
    return xs.length ? xs : undefined;
  }
  if (typeof raw !== 'string') {
    return undefined;
  }
  const t = raw.trim();
  if (!t) {
    return undefined;
  }
  const chunks = t
    .split(/[,;]|(?=\s+H\d)|(?=\s+P\d)|(?=\s+GHS\d{2}\b)/i)
    .map((s) => s.trim())
    .filter(Boolean);
  return chunks.length ? chunks : undefined;
}

export const substanceConcernCodesListSchema = z.preprocess(
  coerceOptionalStringListForZod,
  z.array(z.string().min(1)).optional(),
);

/** Kanonisches Zeilenmodell nach Normalisierung (Ingest/Audit/UI). */
export const substanceConcernEntryCanonicalSchema = z
  .object({
    name: z.string().min(1),
    casNummer: z.string().nullable().optional().default(null),
    anteilOderGrenzwert: z.string().nullable().optional().default(null),
    hinweis: z.string().nullable().optional().default(null),
    /** GHS Hazard Statement codes, z. B. H315 */
    hStatements: substanceConcernCodesListSchema,
    /** GHS Precautionary Statement codes, z. B. P102 */
    pStatements: substanceConcernCodesListSchema,
    /** z. B. GHS07, GHS09 (wörtlich aus dem Dokument übernehmen) */
    ghsPictograms: substanceConcernCodesListSchema,
  })
  .strict();

export type SubstanceConcernEntry = z.infer<typeof substanceConcernEntryCanonicalSchema>;

/**
 * Erlaubt Synonym-/Alias-Keys vom LLM, mappt sie auf das kanonische Modell (ohne unbekannte Keys).
 */
export const substanceConcernEntrySchema = z
  .object({
    name: z.string().min(1).optional(),
    stoffname: z.string().min(1).optional(),
    casNummer: z.string().nullable().optional(),
    casNumber: z.string().nullable().optional(),
    anteilOderGrenzwert: z.string().nullable().optional(),
    concentrationPercent: z.union([z.number(), z.string()]).nullable().optional(),
    hinweis: z.string().nullable().optional(),
    hazardClass: z.string().nullable().optional(),
    hStatements: substanceConcernCodesListSchema,
    pStatements: substanceConcernCodesListSchema,
    ghsPictograms: substanceConcernCodesListSchema,
    hazardStatements: substanceConcernCodesListSchema,
    precautionaryStatements: substanceConcernCodesListSchema,
    /** EN/Alternative Bezeichnung für Piktogramm-Codes */
    ghsSymbols: substanceConcernCodesListSchema,
    hSaetze: substanceConcernCodesListSchema,
    pSaetze: substanceConcernCodesListSchema,
    gefahrenpiktogramme: substanceConcernCodesListSchema,
  })
  .superRefine((row, ctx) => {
    const n = row.name?.trim() || row.stoffname?.trim() || '';
    if (!n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'name or stoffname is required.',
      });
    }
  })
  .transform((row): SubstanceConcernEntry => {
    const name = (row.name?.trim() || row.stoffname?.trim() || '').trim();
    const casNummer = row.casNummer ?? row.casNumber ?? null;
    let anteilOderGrenzwert: string | null = row.anteilOderGrenzwert ?? null;
    if (
      anteilOderGrenzwert === null
      || anteilOderGrenzwert === undefined
      || String(anteilOderGrenzwert).trim() === ''
    ) {
      if (typeof row.concentrationPercent === 'number' && Number.isFinite(row.concentrationPercent)) {
        anteilOderGrenzwert = `${row.concentrationPercent}`;
      } else if (typeof row.concentrationPercent === 'string' && row.concentrationPercent.trim()) {
        anteilOderGrenzwert = row.concentrationPercent.trim();
      } else {
        anteilOderGrenzwert = null;
      }
    }
    let hinweis = row.hinweis ?? null;
    const hazardClassTrim =
      row.hazardClass !== null && row.hazardClass !== undefined ? String(row.hazardClass).trim() : '';
    if ((hinweis === null || hinweis === undefined || hinweis === '') && hazardClassTrim) {
      hinweis = hazardClassTrim;
    }
    const hStatements = row.hStatements ?? row.hazardStatements ?? row.hSaetze;
    const pStatements = row.pStatements ?? row.precautionaryStatements ?? row.pSaetze;
    const ghsPictograms = row.ghsPictograms ?? row.ghsSymbols ?? row.gefahrenpiktogramme;

    const base = {
      name,
      casNummer,
      anteilOderGrenzwert,
      hinweis,
      ...(Array.isArray(hStatements) && hStatements.length ? { hStatements } : {}),
      ...(Array.isArray(pStatements) && pStatements.length ? { pStatements } : {}),
      ...(Array.isArray(ghsPictograms) && ghsPictograms.length ? { ghsPictograms } : {}),
    };
    return substanceConcernEntryCanonicalSchema.parse(base);
  });

export const substanceConcernArraySchema = z.array(substanceConcernEntryCanonicalSchema).min(1);
