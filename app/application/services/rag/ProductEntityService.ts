import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeProductEntityName } from '@/app/domain/rag/normalizeProductEntityName';
import {
  mergeExtractedAttributesJsonForPersistence,
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

/** Escape `%`, `_`, `\` for safe use inside Postgres `ILIKE` patterns (Postgres default escape). */
function escapeForIlikeToken(token: string): string {
  return token.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Wählt wenige, AND-verknüpfbare Tokens aus dem normalisierten Anker (längerer Doc-A-Text vs. kürzerer `products.name`).
 * z.B. "cimsec … s1 … schnell" → Treffer auf "Cimsec S1 Flex Schnell".
 */
function discriminativeNameTokensForIlike(normalizedAnchor: string): readonly string[] {
  const parts = normalizedAnchor.split(/\s+/).filter((t) => t.length >= 2);
  if (parts.length === 0) {
    return [];
  }
  if (parts.length === 1) {
    return [parts[0]!];
  }
  const out: string[] = [];
  const add = (t: string) => {
    if (!out.includes(t)) {
      out.push(t);
    }
  };
  add(parts[0]!);
  for (const p of parts) {
    if (/\d/.test(p)) {
      add(p);
    }
  }
  add(parts[parts.length - 1]!);
  return out.slice(0, 6);
}

export type ExtractedAttributesAnchorMatch = {
  readonly productId: string;
  readonly attributes: Record<string, ExtractedAttributeRow>;
};

/**
 * Kanonische Produkt-Entity + **product knowledge** in `extracted_attributes`
 * (normalisierter Fuzzy-Key `normalized_name`, kein separates `product_knowledge`-Table).
 * Supabase-Fehler werden weitergereicht, außer „Tabelle fehlt noch“ → null / Rollback auf Ingest ohne product_id.
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
   * Lädt `extracted_attributes` für Produkt-Anker (tenant-scoped), mit Fallbacks wenn
   * `normalized_name` nicht exakt zum Anker passt (Doc A vs. Archiv-Entity-Label).
   *
   * 1. Exakt: `normalized_name` = {@link normalizeProductEntityName}(Anker)
   * 2. Fuzzy: RPC `match_product_by_similarity` (pg_trgm)
   * 3. ILIKE: mehrere `name ILIKE '%token%'` (AND), Tokens aus dem normalisierten Anker
   */
  async fetchExtractedAttributesByNormalizedAnchor(
    tenantId: string,
    rawProductAnchor: string,
  ): Promise<ExtractedAttributesAnchorMatch | null> {
    const normalized = normalizeProductEntityName(rawProductAnchor);
    if (!normalized) {
      return null;
    }

    const toMatch = (row: { id: string; extracted_attributes?: unknown } | null | undefined) => {
      if (!row?.id) {
        return null;
      }
      return {
        productId: row.id as string,
        attributes: parseExtractedAttributesJson(row.extracted_attributes),
      } satisfies ExtractedAttributesAnchorMatch;
    };

    const handleSelectError = (message: string): 'null' | 'throw' => {
      if (
        isProductsEntitySchemaErrorMessage(message) ||
        isExtractedAttributesSchemaErrorMessage(message)
      ) {
        return 'null';
      }
      return 'throw';
    };

    const exact = await this.client
      .from('products')
      .select('id, extracted_attributes')
      .eq('tenant_id', tenantId)
      .eq('normalized_name', normalized)
      .maybeSingle();

    if (exact.error) {
      const h = handleSelectError(exact.error.message);
      if (h === 'null') {
        return null;
      }
      throw new Error(`products extracted_attributes exact lookup failed: ${exact.error.message}`);
    }
    const exactMatch = toMatch(exact.data as { id: string; extracted_attributes?: unknown } | null);
    if (exactMatch) {
      return exactMatch;
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
      throw new Error(`products similarity rpc failed: ${fuzzy.error.message}`);
    }

    const simRows = (fuzzy.data ?? []) as SimilarityRpcRow[];
    const simId = simRows[0]?.id;
    if (simId) {
      const byId = await this.client
        .from('products')
        .select('id, extracted_attributes')
        .eq('tenant_id', tenantId)
        .eq('id', simId)
        .maybeSingle();

      if (byId.error) {
        const h = handleSelectError(byId.error.message);
        if (h === 'null') {
          return null;
        }
        throw new Error(`products extracted_attributes by id failed: ${byId.error.message}`);
      }
      const simMatch = toMatch(byId.data as { id: string; extracted_attributes?: unknown } | null);
      if (simMatch) {
        return simMatch;
      }
    }

    const tokens = discriminativeNameTokensForIlike(normalized);
    if (tokens.length === 0) {
      return null;
    }

    let ilikeQuery = this.client
      .from('products')
      .select('id, extracted_attributes')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1);

    for (const t of tokens) {
      const pat = `%${escapeForIlikeToken(t)}%`;
      ilikeQuery = ilikeQuery.ilike('name', pat);
    }

    const ilikeRes = await ilikeQuery;

    if (ilikeRes.error) {
      const h = handleSelectError(ilikeRes.error.message);
      if (h === 'null') {
        return null;
      }
      throw new Error(`products extracted_attributes ilike lookup failed: ${ilikeRes.error.message}`);
    }

    const ilikeRow = (ilikeRes.data ?? [])[0] as { id: string; extracted_attributes?: unknown } | undefined;
    return toMatch(ilikeRow);
  }

  /**
   * Safe-Merge / Cumulative Memory: SELECT → `{ ...existing, ...new }` (value-safe) → UPDATE.
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
      .single();

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

    const existing =
      typeof cur.data?.extracted_attributes === 'object' &&
      cur.data.extracted_attributes !== null &&
      !Array.isArray(cur.data.extracted_attributes)
        ? (cur.data.extracted_attributes as Record<string, unknown>)
        : {};

    const newlyExtractedData = incoming;

    console.log(
      `MERGE-CHECK: Behalte ${Object.keys(existing).join(', ')} und füge ${Object.keys(newlyExtractedData).join(', ')} hinzu.`,
    );

    const finalAttributes = mergeExtractedAttributesJsonForPersistence(existing, newlyExtractedData);

    console.log(
      `MERGE-CHECK: final keys nach Merge: ${Object.keys(finalAttributes).join(', ')}`,
    );
    console.log('[EAGER MERGE] finalAttributes:', JSON.stringify(finalAttributes, null, 2));

    const upd = await this.client
      .from('products')
      .update({ extracted_attributes: finalAttributes })
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
