import { z } from 'zod';

/**
 * Besorgniserregende / ausgewiesene Stoffe (z. B. Abschnitt 3 „Grenzwerte“, SVHC-Hinweise).
 * Kanonischer Speicher-Key in der Ingestion: `substancesOfConcern` (Synonyme → Passport `gefahrenstoffe`).
 */
export const substanceConcernEntrySchema = z
  .object({
    name: z.string().min(1),
    casNummer: z.string().nullable(),
    anteilOderGrenzwert: z.string().nullable(),
    hinweis: z.string().nullable(),
  })
  .strict();

export type SubstanceConcernEntry = z.infer<typeof substanceConcernEntrySchema>;

export const substanceConcernArraySchema = z.array(substanceConcernEntrySchema).min(1);
