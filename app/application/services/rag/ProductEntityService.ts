import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeProductEntityName } from '@/app/domain/rag/normalizeProductEntityName';

type SimilarityRpcRow = { id: string; sim?: number };

/**
 * Links free-text product labels to canonical `products` rows (entity-centric RAG).
 * All Supabase errors propagate — RLS/FK failures must not be swallowed.
 */
export class ProductEntityService {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Exact match on `normalized_name`, then pg_trgm similarity via RPC. No insert.
   */
  async findProductEntityId(tenantId: string, rawProductName: string): Promise<string | null> {
    const normalized = normalizeProductEntityName(rawProductName);
    if (!normalized) {
      return null;
    }

    const exact = await this.client
      .from('products')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('normalized_name', normalized)
      .maybeSingle();

    if (exact.error) {
      throw new Error(`products exact lookup failed: ${exact.error.message}`);
    }
    if (exact.data?.id) {
      return exact.data.id as string;
    }

    const fuzzy = await this.client.rpc('match_product_by_similarity', {
      p_tenant_id: tenantId,
      p_normalized: normalized,
      p_min_similarity: 0.42,
    });

    if (fuzzy.error) {
      throw new Error(`products fuzzy lookup failed: ${fuzzy.error.message}`);
    }

    const rows = (fuzzy.data ?? []) as SimilarityRpcRow[];
    const hit = rows[0];
    return hit?.id ?? null;
  }

  /**
   * Resolves an existing entity or inserts a new row. Used at document ingest time.
   */
  async resolveOrCreateProduct(tenantId: string, rawProductName: string): Promise<string> {
    const existing = await this.findProductEntityId(tenantId, rawProductName);
    if (existing) {
      return existing;
    }

    const displayName = rawProductName.trim().slice(0, 512) || rawProductName.trim();
    const normalized = normalizeProductEntityName(rawProductName);
    if (!normalized) {
      throw new Error('Product name normalizes to empty string; cannot create entity.');
    }

    const ins = await this.client
      .from('products')
      .insert({
        tenant_id: tenantId,
        name: displayName.length > 0 ? displayName : normalized,
        normalized_name: normalized,
      })
      .select('id')
      .single();

    if (ins.error) {
      if (ins.error.code === '23505') {
        const again = await this.findProductEntityId(tenantId, rawProductName);
        if (again) {
          return again;
        }
      }
      throw new Error(`products insert failed: ${ins.error.message}`);
    }

    if (!ins.data?.id) {
      throw new Error('products insert returned no id.');
    }

    return ins.data.id as string;
  }
}
