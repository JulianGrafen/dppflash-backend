import { basename } from 'node:path';
import { DocumentIngestionService } from '@/app/application/services/rag/DocumentIngestionService';
import { HybridRetrievalService } from '@/app/application/services/rag/HybridRetrievalService';
import { ComplianceEnrichmentAgent } from '@/app/application/services/rag/ComplianceEnrichmentAgent';
import type { IngestPdfInput } from '@/app/application/services/rag/DocumentIngestionService';
import type { HybridRetrievalInput } from '@/app/application/services/rag/HybridRetrievalService';
import type { ComplianceEnrichmentInput, ComplianceEnrichmentResult } from '@/app/application/services/rag/ComplianceEnrichmentAgent';
import { mapGapFieldKeyToGermanSearchPhrase } from '@/app/domain/rag/dppRagGapAnalysis';
import { safeParseAuditTrail } from '@/app/domain/rag/auditTrailSchema';
import { validateAuditTrailCryptographically } from '@/app/domain/rag/auditTrailValidation';
import { computeRetrievalMatchConfidence } from '@/app/domain/rag/productBrainMatch';
import type { RetrievedChunk } from '@/app/application/services/rag/HybridRetrievalService';

export interface RagComplianceRunInput {
  readonly tenantId: string;
  readonly productLabel: string;
  readonly query: string;
  /** When set, the enrichment agent asks for a provenance map under \`fields\` for these passport keys. */
  readonly targetPassportFieldKeys?: readonly string[];
  readonly retrievalTopK?: number;
  /** Product-line tokens: more overlap with chunk text / fileName → higher rank and match confidence. */
  readonly productMatchTerms?: readonly string[];
  /** Basename/path der Primär-PDF; **nicht** für Ranking-Boost — nur zum Ausschluss aus dem RAG-Kontext. */
  readonly sourceFileName?: string;
  /** Canonical `products.id`: prefer chunks for this entity, then tenant fallback. */
  readonly productEntityId?: string;
}

/** Nach Multi-Field-Retrieval + Filter: so viele Chunks maximal an den Gap-LLM. */
const GAP_TARGETED_FINAL_CHUNK_LIMIT = 10;

/** Stufe 2–4: gezielte Lückenfüllung (feldweise Hybrid-Suche + sekundäres LLM). */
export interface RagGapTargetedRunInput {
  readonly tenantId: string;
  readonly productLabel: string;
  /** Fallback, wenn `missingFields` leer: eine kombinierte Suchphrase + LLM-Metadaten. */
  readonly gapSearchQuery: string;
  readonly anchorProductName: string;
  /** Fehlende Passport-Keys — je Key eine eigene Hybrid-Suche (`retrieveTopChunks`). */
  readonly missingFields: readonly string[];
  readonly retrievalTopK?: number;
  readonly productMatchTerms?: readonly string[];
  /**
   * Primär-PDF (Metadaten): wird **nicht** an die Gap-Hybrid-Suche durchgereicht (kein same-File-Boost),
   * bleibt aber für Match-Konfidenz nach Retrieval relevant.
   */
  readonly sourceFileName?: string;
  /**
   * Pfad/Basename der **hochgeladenen** Primär-PDF (Doc A). Identifiziert dieselbe Datei wie
   * `sourceFileName` für den Ausschluss — mindestens eines sollte im Upload-Flow gesetzt sein.
   */
  readonly excludePrimaryBasename?: string;
  /** Canonical `products.id` for entity-scoped retrieval (falls back to tenant-wide if empty). */
  readonly productEntityId?: string;
}

export interface RagComplianceExtractionOutcome {
  readonly enrichment: ComplianceEnrichmentResult;
  readonly retrievalMatchConfidence: number;
}

/**
 * Thin orchestrator wiring ingestion → retrieval → forensic LLM synthesis.
 */
export class RagComplianceOrchestrator {
  constructor(
    private readonly ingestion: DocumentIngestionService,
    private readonly retrieval: HybridRetrievalService,
    private readonly enrichment: ComplianceEnrichmentAgent,
  ) {}

  ingestPdf(input: IngestPdfInput): Promise<{ readonly chunkCount: number }> {
    return this.ingestion.ingestPdf(input);
  }

  async runComplianceExtraction(input: RagComplianceRunInput): Promise<RagComplianceExtractionOutcome> {
    const defaultTopK =
      input.retrievalTopK ??
      (input.targetPassportFieldKeys?.length
        ? Math.min(36, 16 + Math.floor(input.targetPassportFieldKeys.length / 2))
        : 18);

    const retrievalInput: HybridRetrievalInput = {
      tenantId: input.tenantId,
      query: input.query,
      topK: defaultTopK,
      productMatchTerms: input.productMatchTerms,
      sourceFileName: undefined,
      productEntityId: input.sourceFileName?.trim() ? undefined : input.productEntityId,
    };

    let chunks = await this.retrieval.retrieveTopChunks(retrievalInput);

    const primaryEx = input.sourceFileName?.trim();
    if (primaryEx) {
      const ex = basename(primaryEx).toLowerCase();
      chunks = chunks.filter((c) => basename(c.fileName).toLowerCase() !== ex);
    }

    const retrievalMatchConfidence = computeRetrievalMatchConfidence(
      chunks,
      input.productMatchTerms ?? [],
      input.sourceFileName,
    );

    if (chunks.length === 0) {
      const emptyTrail = safeParseAuditTrail({ fields: {} });
      if (!emptyTrail.success) {
        throw new Error(emptyTrail.error.message);
      }
      const data = emptyTrail.data;
      const enrichment: ComplianceEnrichmentResult = {
        auditTrail: data,
        rawModelJson: '{"fields":{}}',
        cryptoValidation: validateAuditTrailCryptographically(data),
      };
      return { enrichment, retrievalMatchConfidence: 0 };
    }

    const enrichmentInput: ComplianceEnrichmentInput = {
      tenantId: input.tenantId,
      productLabel: input.productLabel,
      query: input.query,
      chunks,
      targetPassportFieldKeys: input.targetPassportFieldKeys,
    };

    const enrichment = await this.enrichment.synthesize(enrichmentInput);
    return { enrichment, retrievalMatchConfidence };
  }

  /**
   * Targeted RAG: **Field-Specific Retrieval** — pro fehlendem Passport-Key eine eigene Hybrid-Suche
   * (`mapGapFieldKeyToGermanSearchPhrase` + Produkt-Anker), Merge, Dedupe nach `id`,
   * **ausschließlich Chunks aus anderen Dateien** als der Primär-Upload (kein Fallback auf Doc A),
   * dann Top-K ans Gap-LLM.
   *
   * @returns `null` wenn nach Retrieval **keine** passenden Fremd-Dokument-Chunks übrig sind (kein LLM-Lauf).
   */
  async runGapTargetedEnrichment(input: RagGapTargetedRunInput): Promise<RagComplianceExtractionOutcome | null> {
    const anchor = input.anchorProductName;
    const missingFields = input.missingFields;
    const perFieldTopK = Math.max(10, input.retrievalTopK ?? 24);

    /** Primär-Upload (Doc A): RAG nutzt nur **andere** Dateien — niemals dieselbe PDF wie beim DPP-Upload. */
    const primaryUploadPath =
      (input.excludePrimaryBasename?.trim() || input.sourceFileName?.trim()) ?? '';

    /**
     * Archiv-Suche: tenant-weit, sobald wir den Primär-Upload kennen (sonst fehlen oft B/C ohne `product_id`).
     * Ohne `primaryUploadPath` bleibt optionaler Entity-Scope wie bisher.
     */
    const retrievalProductEntityId = primaryUploadPath ? undefined : input.productEntityId;

    const baseRetrieval: Pick<
      HybridRetrievalInput,
      'tenantId' | 'productMatchTerms' | 'sourceFileName' | 'productEntityId'
    > = {
      tenantId: input.tenantId,
      productMatchTerms: input.productMatchTerms,
      sourceFileName: undefined,
      productEntityId: retrievalProductEntityId,
    };

    const pooled: RetrievedChunk[] = [];

    if (missingFields.length > 0) {
      for (const field of missingFields) {
        const query = `${mapGapFieldKeyToGermanSearchPhrase(field)} für das Produkt: ${anchor}`;
        const fieldChunks = await this.retrieval.retrieveTopChunks({
          ...baseRetrieval,
          query,
          topK: perFieldTopK,
        });
        pooled.push(...fieldChunks);
      }
    } else {
      const fieldChunks = await this.retrieval.retrieveTopChunks({
        ...baseRetrieval,
        query: input.gapSearchQuery,
        topK: perFieldTopK,
      });
      pooled.push(...fieldChunks);
    }

    const byId = new Map<string, RetrievedChunk>();
    for (const c of pooled) {
      const prev = byId.get(c.id);
      if (!prev || c.score > prev.score) {
        byId.set(c.id, c);
      }
    }
    let deduped = [...byId.values()];
    const afterIdDedupeCount = deduped.length;

    if (primaryUploadPath) {
      const ex = basename(primaryUploadPath).toLowerCase();
      deduped = deduped.filter((c) => basename(c.fileName).toLowerCase() !== ex);
    }
    const afterBasenameCount = deduped.length;

    deduped.sort((a, b) => b.score - a.score);
    const chunks = deduped.slice(0, GAP_TARGETED_FINAL_CHUNK_LIMIT);

    const gapSearchQueryForAgent =
      missingFields.length > 0
        ? missingFields
            .map((f) => `${mapGapFieldKeyToGermanSearchPhrase(f)} für das Produkt: ${anchor}`)
            .join(' | ')
        : input.gapSearchQuery;

    const retrievalMatchConfidence = computeRetrievalMatchConfidence(
      chunks,
      input.productMatchTerms ?? [],
      input.sourceFileName,
    );

    console.log('=== RAG DEBUG AUDIT (field-specific retrieval) ===');
    console.log('1. Feldsuchen:', missingFields.length > 0 ? missingFields.join(', ') : '(fallback gapSearchQuery)');
    console.log(
      '2. Roh-Treffer:',
      pooled.length,
      '| id-Dedupe:',
      afterIdDedupeCount,
      '| nach basename:',
      afterBasenameCount,
      `| Top-${GAP_TARGETED_FINAL_CHUNK_LIMIT} ans LLM:`,
      chunks.length,
    );
    if (chunks.length > 0) {
      const t = chunks[0]!.text;
      console.log('3. Bester Chunk Text-Snippet:', t.substring(0, Math.min(200, t.length)));
    } else {
      console.log('3. FEHLER: Supabase hat NICHTS gefunden!');
    }
    console.log('==================================================');

    if (chunks.length === 0) {
      return null;
    }

    console.log('[Orchestrator] Starte LLM-Agent für Extraktion...');
    const agentResult = await this.enrichment.gapTargetedExtraction({
      tenantId: input.tenantId,
      productLabel: input.productLabel,
      gapSearchQuery: gapSearchQueryForAgent,
      anchorProductName: input.anchorProductName,
      missingFields: input.missingFields,
      chunks,
    });
    console.log('[Orchestrator] LLM-Agent hat geantwortet:', agentResult);

    return { enrichment: agentResult, retrievalMatchConfidence };
  }
}
