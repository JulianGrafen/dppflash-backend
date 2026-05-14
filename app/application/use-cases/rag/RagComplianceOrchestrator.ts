import { basename } from 'node:path';
import { DocumentIngestionService } from '@/app/application/services/rag/DocumentIngestionService';
import { HybridRetrievalService } from '@/app/application/services/rag/HybridRetrievalService';
import { ComplianceEnrichmentAgent } from '@/app/application/services/rag/ComplianceEnrichmentAgent';
import type { IngestPdfInput } from '@/app/application/services/rag/DocumentIngestionService';
import type { HybridRetrievalInput } from '@/app/application/services/rag/HybridRetrievalService';
import type { ComplianceEnrichmentInput, ComplianceEnrichmentResult } from '@/app/application/services/rag/ComplianceEnrichmentAgent';
import { safeParseAuditTrail } from '@/app/domain/rag/auditTrailSchema';
import { validateAuditTrailCryptographically } from '@/app/domain/rag/auditTrailValidation';
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
  /** Basename/path of primary PDF; boosts chunks from that file when it matches stored rows. */
  readonly sourceFileName?: string;
}

/** Stufe 2–4: gezielte Lückenfüllung (Retrieval mit gapSearchQuery + sekundäres LLM). */
export interface RagGapTargetedRunInput {
  readonly tenantId: string;
  readonly productLabel: string;
  readonly gapSearchQuery: string;
  readonly anchorProductName: string;
  readonly targetPassportFieldKeys: readonly string[];
  readonly retrievalTopK?: number;
  readonly productMatchTerms?: readonly string[];
  readonly sourceFileName?: string;
  /**
   * Primär-PDF (Doc A): bevorzugt Chunks aus *anderen* Dateien, damit Doc B zuerst genutzt wird.
   * Wenn danach keine Chunks übrig bleiben, Fallback auf alle Treffer.
   */
  readonly excludePrimaryBasename?: string;
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
   * Targeted RAG: tenant-scoped hybrid search (Supabase `rag_chunks` oder In-Memory) mit
   * programmatisch gebauter Suchanfrage; optional ohne Chunks aus der Primär-Datei.
   */
  async runGapTargetedEnrichment(input: RagGapTargetedRunInput): Promise<RagComplianceExtractionOutcome> {
    const defaultTopK = input.retrievalTopK ?? 24;

    const retrievalInput: HybridRetrievalInput = {
      tenantId: input.tenantId,
      query: input.gapSearchQuery,
      topK: defaultTopK,
      productMatchTerms: input.productMatchTerms,
      sourceFileName: input.sourceFileName,
    };

    let chunks = await this.retrieval.retrieveTopChunks(retrievalInput);

    if (input.excludePrimaryBasename) {
      const ex = basename(input.excludePrimaryBasename);
      const other = chunks.filter((c) => basename(c.fileName) !== ex);
      if (other.length > 0) {
        chunks = other;
      }
    }

    const retrievalMatchConfidence = computeRetrievalMatchConfidence(
      chunks,
      input.productMatchTerms ?? [],
      input.sourceFileName,
    );

    const searchQuery = input.gapSearchQuery;
    const retrievedChunks = chunks;
    console.log('=== RAG DEBUG AUDIT ===');
    console.log('1. Such-String an DB:', searchQuery);
    console.log('2. Anzahl gefundene Chunks:', retrievedChunks.length);
    if (retrievedChunks.length > 0) {
      const t = retrievedChunks[0]!.text;
      console.log('3. Bester Chunk Text-Snippet:', t.substring(0, Math.min(200, t.length)));
    } else {
      console.log('3. FEHLER: Supabase hat NICHTS gefunden!');
    }
    console.log('=======================');

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
      query: input.gapSearchQuery,
      chunks,
      targetPassportFieldKeys: input.targetPassportFieldKeys,
      gapTargetedExtraction: {
        anchorProductName: input.anchorProductName,
        missingFieldKeys: input.targetPassportFieldKeys,
      },
    };

    const enrichment = await this.enrichment.synthesize(enrichmentInput);
    return { enrichment, retrievalMatchConfidence };
  }
}
