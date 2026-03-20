import { createClient } from '@supabase/supabase-js';

/**
 * Singleton Supabase Client für alle Server-seitigen Operationen.
 * 
 * Architektur-Entscheidung: 
 * - Nutzt Server-seitige Variablen (kein Exposure von Keys in Frontend)
 * - Kann später leicht auf andere Datenbanken migriert werden
 * 
 * Env-Variablen erforderlich:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (Server-only, nicht in Browser exposen)
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase Umgebungsvariablen nicht konfiguriert. Bitte .env.local überprüfen.');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false, // Server-only Client
  },
});

/**
 * Bucket-Namen für Datenspeicherung (konstant).
 * Ermöglicht zentrale Verwaltung und leichte Änderungen.
 */
export const STORAGE_BUCKETS = {
  PDF_UPLOADS: 'pdf-uploads',
  EXTRACTED_DATA: 'extracted-data',
} as const;
