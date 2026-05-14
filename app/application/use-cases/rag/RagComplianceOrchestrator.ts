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
  /** Basename/path of primary PDF; boosts chunks from that file when it matches stored rows. */
  readonly sourceFileName?: string;
  /** Canonical `products.id`: prefer chunks for this entity, then tenant fallback. */
  readonly productEntityId?: string;
}

/** Nach Multi-Field-Retrieval + Filter: so viele Chunks maximal an den Gap-LLM. */
const GAP_TARGETED_FINAL_CHUNK_LIMIT = 10;

/** Stufe 2–4: gezielte Lückenfüllung (Retrieval mit gapSearchQuery + sekundäres LLM). */
export interface RagGapTargetedRunInput {
  readonly tenantId: string;
  readonly productLabel: string;
  /** Fallback / LLM-Metadaten: zusammengefasste Suchphrase; Retrieval nutzt primär `targetPassportFieldKeys`. */
  readonly gapSearchQuery: string;
  readonly anchorProductName: string;
  /** Fehlende Passport-Keys — je Key eine eigene Hybrid-Suche (Field-Specific Retrieval). */
  readonly targetPassportFieldKeys: readonly string[];
  readonly retrievalTopK?: number;
  readonly productMatchTerms?: readonly string[];
  readonly sourceFileName?: string;
  /**
   * Primär-PDF (Doc A): bevorzugt Chunks aus *anderen* Dateien, damit Doc B zuerst genutzt wird.
   * Wenn danach keine Chunks übrig bleiben, Fallback auf alle Treffer.
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
      sourceFileName: input.sourceFileName,
      productEntityId: input.productEntityId,
    };

    const chunks = await this.retrieval.retrieveTopChunks(retrievalInput);

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
   * (`mapGapFieldKeyToGermanSearchPhrase` + Produkt-Anker), dann Pool mergen, per `id` deduplizieren,
   * optional Primär-PDF (basename) ausfiltern, global nach `score` sortieren, Top-10 an den Gap-LLM.
   *
   * @returns `null` wenn nach Retrieval **keine** Chunks übrig sind (kein LLM-Lauf). Sonst Outcome inkl. Stufe 4.
   */
  async runGapTargetedEnrichment(input: RagGapTargetedRunInput): Promise<RagComplianceExtractionOutcome | null> {
    const anchor = input.anchorProductName;
    const missingFields = input.targetPassportFieldKeys;
    const perFieldTopK = Math.max(10, input.retrievalTopK ?? 24);

    const baseRetrieval: Pick<
      HybridRetrievalInput,
      'tenantId' | 'productMatchTerms' | 'sourceFileName' | 'productEntityId'
    > = {
      tenantId: input.tenantId,
      productMatchTerms: input.productMatchTerms,
      sourceFileName: input.sourceFileName,
      productEntityId: input.productEntityId,
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
    const byText = new Map<string, RetrievedChunk>();
    for (const c of byId.values()) {
      const prev = byText.get(c.text);
      if (!prev || c.score > prev.score) {
        byText.set(c.text, c);
      }
    }
    let deduped = [...byText.values()];
    const afterTextDedupeCount = deduped.length;

    if (input.excludePrimaryBasename) {
      const ex = basename(input.excludePrimaryBasename);
      const other = deduped.filter((c) => basename(c.fileName) !== ex);
      if (other.length > 0) {
        deduped = other;
      }
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
      '| id+text-Dedupe:',
      afterTextDedupeCount,
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
      missingFields: input.targetPassportFieldKeys,
      chunks,
    });
    console.log('[Orchestrator] LLM-Agent hat geantwortet:', agentResult);

    return { enrichment: agentResult, retrievalMatchConfidence };
  }
}
