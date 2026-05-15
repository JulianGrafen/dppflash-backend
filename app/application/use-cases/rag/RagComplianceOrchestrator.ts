import { basename } from 'node:path';
import { DocumentIngestionService } from '@/app/application/services/rag/DocumentIngestionService';
import { HybridRetrievalService } from '@/app/application/services/rag/HybridRetrievalService';
import { ComplianceEnrichmentAgent } from '@/app/application/services/rag/ComplianceEnrichmentAgent';
import type { IngestPdfInput } from '@/app/application/services/rag/DocumentIngestionService';
import type { HybridRetrievalInput } from '@/app/application/services/rag/HybridRetrievalService';
import type { ComplianceEnrichmentInput, ComplianceEnrichmentResult } from '@/app/application/services/rag/ComplianceEnrichmentAgent';
import type { ProductEntityService } from '@/app/application/services/rag/ProductEntityService';
import { safeParseAuditTrail } from '@/app/domain/rag/auditTrailSchema';
import { validateAuditTrailCryptographically } from '@/app/domain/rag/auditTrailValidation';
import { extractedAttributesToAuditTrailFields } from '@/app/domain/rag/extractedAttributesJson';
import { computeRetrievalMatchConfidence } from '@/app/domain/rag/productBrainMatch';

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

/** Eager Gap-Fill: Metadaten für Aufrufer / Logging (Live-Pfad nutzt `products.extracted_attributes`). */
export interface RagGapTargetedRunInput {
  readonly tenantId: string;
  readonly productLabel: string;
  readonly gapSearchQuery: string;
  readonly anchorProductName: string;
  readonly missingFields: readonly string[];
  readonly retrievalTopK?: number;
  readonly productMatchTerms?: readonly string[];
  readonly sourceFileName?: string;
  readonly excludePrimaryBasename?: string;
  readonly productEntityId?: string;
}

export interface RagComplianceExtractionOutcome {
  readonly enrichment: ComplianceEnrichmentResult;
  readonly retrievalMatchConfidence: number;
}

/**
 * Orchestrator:
 *
 * - **Ingestion (Doc B/C):** {@link DocumentIngestionService} füllt das „Gehirn“
 *   (`products.extracted_attributes` + `normalized_name` ≈ `product_knowledge`).
 * - **Retrieval (Doc A):** {@link fillGapsWithEagerKnowledge} — direkter DB-Lookup per Fuzzy-Anker,
 *   kein Chunk-RAG-Loop für Lücken.
 */
export class RagComplianceOrchestrator {
  constructor(
    private readonly ingestion: DocumentIngestionService,
    private readonly retrieval: HybridRetrievalService,
    private readonly enrichment: ComplianceEnrichmentAgent,
    private readonly productEntityService?: ProductEntityService | null,
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
   * Doc A: Structured Key Match statt Vektorsuche.
   * `SELECT extracted_attributes FROM products WHERE normalized_name` (exakt → pg_trgm → ILIKE).
   */
  async fillGapsWithEagerKnowledge(
    input: RagGapTargetedRunInput,
  ): Promise<RagComplianceExtractionOutcome | null> {
    return this.runGapTargetedEnrichment(input);
  }

  /**
   * Lückenfüllung aus `products.extracted_attributes` (tenant + normalisierter Produkt-Anker).
   * Kein Live-LLM — Werte stammen aus {@link BackgroundExtractionAgent} beim PDF-Ingest.
   */
  async runGapTargetedEnrichment(input: RagGapTargetedRunInput): Promise<RagComplianceExtractionOutcome | null> {
    const anchor = input.anchorProductName.trim();
    const missingFields = input.missingFields;

    if (!anchor || missingFields.length === 0 || !this.productEntityService) {
      return null;
    }

    const resolved = await this.productEntityService.fetchExtractedAttributesByNormalizedAnchor(
      input.tenantId,
      anchor,
    );

    if (!resolved) {
      console.info('[RAG] eager_gap_skip', {
        reason: 'no_extracted_attributes',
        tenantId: input.tenantId,
        anchorPreview: anchor.slice(0, 80),
      });
      return null;
    }

    const stored = resolved.attributes;

    console.log('[Orchestrator] Rohes DB JSON:', JSON.stringify(stored, null, 2));
    console.log('[Orchestrator] Eager gap missingFields:', JSON.stringify(missingFields));
    console.log('[Orchestrator] Eager gap JSON top-level keys:', JSON.stringify(Object.keys(stored)));

    if (Object.keys(stored).length === 0) {
      console.log('[Orchestrator] JSON ist leer - Background Agent hat nichts extrahiert!');
      return null;
    }

    console.info(`[Orchestrator] Eager Data gefunden für Produkt-ID: ${resolved.productId}`);

    const { fields, keyResolution } = extractedAttributesToAuditTrailFields(stored, missingFields);
    console.log('[Orchestrator] Eager key resolution (passportKey <- storedKey):', JSON.stringify(keyResolution, null, 2));

    if (Object.keys(fields).length === 0) {
      console.warn('[Orchestrator] Eager gap: keine Felder nach Synonym/Case-Match — Abbruch (no_matching_missing_fields).', {
        tenantId: input.tenantId,
        missingFields,
        storedKeys: Object.keys(stored),
        keyResolution,
      });
      console.info('[RAG] eager_gap_skip', {
        reason: 'no_matching_missing_fields',
        tenantId: input.tenantId,
        missingFields,
      });
      return null;
    }

    console.log('[Orchestrator] Eager gemappte audit fields keys:', JSON.stringify(Object.keys(fields)));

    const trail = safeParseAuditTrail({ fields });
    if (!trail.success) {
      console.warn('[RAG] eager_gap_audit_parse_failed', trail.error.message);
      return null;
    }

    const confidences = Object.values(trail.data.fields ?? {}).map((v) => v.confidence);
    const retrievalMatchConfidence = confidences.length > 0 ? Math.max(...confidences) : 0;

    const enrichment: ComplianceEnrichmentResult = {
      auditTrail: trail.data,
      rawModelJson: JSON.stringify({
        source: 'products.extracted_attributes',
        productId: resolved.productId,
        appliedKeys: Object.keys(fields),
        keyResolution,
      }),
      cryptoValidation: validateAuditTrailCryptographically(trail.data),
    };

    console.log(
      '[Orchestrator] Eager audit trail chemicalComposition:',
      trail.data.fields?.chemicalComposition?.value ?? '(nicht gesetzt)',
    );

    return { enrichment, retrievalMatchConfidence };
  }
}
