import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeProductEntityName } from '@/app/domain/rag/normalizeProductEntityName';
import {
  mergeExtractedAttributesMaps,
  parseExtractedAttributesJson,
  type ExtractedAttributeRow,
} from '@/app/domain/rag/extractedAttributesJson';

type SimilarityRpcRow = { id: string; sim?: number };

/**
 * PostgREST meldet fehlende Tabelle / veralteten Schema-Cache so — dann noch kein Migration-Lauf.
 */
function isProductsEntitySchemaErrorMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('schema cache') ||
    (m.includes('could not find the table') && m.includes('products')) ||
    (m.includes('relation') && m.includes('products') && m.includes('does not exist'))
  );
}

function isExtractedAttributesSchemaErrorMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('extracted_attributes') &&
    (m.includes('does not exist') || m.includes('schema cache') || m.includes('could not find'))
  );
}

/**
 * Links free-text product labels to canonical `products` rows (entity-centric RAG).
 * Supabase-Fehler werden weitergereicht, außer „Tabelle fehlt noch“ → null / Rollback auf Ingest ohne product_id (siehe DocumentIngestionService).
 */
export class ProductEntityService {
  constructor(private readonly client: SupabaseClient) {}

  static isProductsEntitySchemaErrorMessage(message: string): boolean {
    return isProductsEntitySchemaErrorMessage(message);
  }

  /**
   * Exact match on `normalized_name`, then pg_trgm similarity via RPC. No insert.
   * Wenn die Tabelle `products` (noch) nicht existiert: `null`, kein Throw.
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
      if (isProductsEntitySchemaErrorMessage(exact.error.message)) {
        return null;
      }
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
      if (isProductsEntitySchemaErrorMessage(fuzzy.error.message)) {
        return null;
      }
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
      if (isProductsEntitySchemaErrorMessage(ins.error.message)) {
        throw new Error(`products insert failed: ${ins.error.message}`);
      }
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

  /**
   * Lädt `extracted_attributes` für Produkt-Anker (normalisierter Name, tenant-scoped).
   * Fehlende Spalte / Tabelle → `null`.
   */
  async fetchExtractedAttributesByNormalizedAnchor(
    tenantId: string,
    rawProductAnchor: string,
  ): Promise<Record<string, ExtractedAttributeRow> | null> {
    const normalized = normalizeProductEntityName(rawProductAnchor);
    if (!normalized) {
      return null;
    }

    const res = await this.client
      .from('products')
      .select('extracted_attributes')
      .eq('tenant_id', tenantId)
      .eq('normalized_name', normalized)
      .maybeSingle();

    if (res.error) {
      if (
        isProductsEntitySchemaErrorMessage(res.error.message) ||
        isExtractedAttributesSchemaErrorMessage(res.error.message)
      ) {
        return null;
      }
      throw new Error(`products extracted_attributes lookup failed: ${res.error.message}`);
    }

    if (res.data == null) {
      return null;
    }

    const raw = (res.data as { extracted_attributes?: unknown }).extracted_attributes;
    return parseExtractedAttributesJson(raw);
  }

  /**
   * Merged `incoming` in `products.extracted_attributes` per Feld (höhere `confidence` gewinnt).
   */
  async mergeExtractedAttributes(
    productId: string,
    incoming: Readonly<Record<string, ExtractedAttributeRow>>,
  ): Promise<void> {
    if (Object.keys(incoming).length === 0) {
      return;
    }

    const cur = await this.client
      .from('products')
      .select('extracted_attributes')
      .eq('id', productId)
      .maybeSingle();

    if (cur.error) {
      if (
        isProductsEntitySchemaErrorMessage(cur.error.message) ||
        isExtractedAttributesSchemaErrorMessage(cur.error.message)
      ) {
        console.warn('[DPP] merge_extracted_attributes skipped (schema):', cur.error.message);
        return;
      }
      throw new Error(`products read for merge failed: ${cur.error.message}`);
    }

    const existing = parseExtractedAttributesJson(
      (cur.data as { extracted_attributes?: unknown } | null)?.extracted_attributes,
    );
    const merged = mergeExtractedAttributesMaps(existing, incoming);

    const upd = await this.client
      .from('products')
      .update({ extracted_attributes: merged })
      .eq('id', productId);

    if (upd.error) {
      if (
        isProductsEntitySchemaErrorMessage(upd.error.message) ||
        isExtractedAttributesSchemaErrorMessage(upd.error.message)
      ) {
        console.warn('[DPP] merge_extracted_attributes update skipped (schema):', upd.error.message);
        return;
      }
      throw new Error(`products extracted_attributes update failed: ${upd.error.message}`);
    }
  }
}
