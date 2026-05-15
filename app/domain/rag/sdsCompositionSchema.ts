import { z } from 'zod';

/**
 * Einzelner Stoff aus SDS Abschnitt 3 — Struktur für Eager-Ingestion und Audit-Trail.
 * (Englische DPP-Kernfelder nutzen teils andere Keys; Mapping erfolgt bei Bedarf in UI/Validation.)
 */
export const sdsCompositionEntrySchema = z.object({
  stoffname: z.string().describe("Der Name des Inhaltsstoffs, z.B. 'Quarz (SiO2)'"),
  casNummer: z.string().nullable().describe('Die CAS-Nummer, falls vorhanden'),
  prozentAnteil: z.string().describe("Die genaue Konzentration oder Range in %, z.B. '40- 60 %' oder '< 1%'"),
  einstufung: z.string().nullable().describe("Die Gefahren-Einstufung, z.B. 'Skin Irrit. 2, H315'"),
});

export type SdsCompositionEntry = z.infer<typeof sdsCompositionEntrySchema>;

/** Mind. ein Stoff — für Audit / Passport-Merge (nicht null). */
export const sdsCompositionArraySchema = z.array(sdsCompositionEntrySchema).min(1);
