import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/app/lib/supabase';

/**
 * Thrown when server-side Supabase credentials are missing.
 */
export class SupabaseConfigurationError extends Error {
  constructor() {
    super(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for backend operations.',
    );
    this.name = 'SupabaseConfigurationError';
  }
}

/**
 * Returns the shared Supabase client (service role) for server-only use.
 * Single source of truth with {@link supabase} in `./supabase.ts`.
 */
export function requireSupabaseServiceRoleClient(): SupabaseClient {
  if (!supabase) {
    throw new SupabaseConfigurationError();
  }
  return supabase;
}
