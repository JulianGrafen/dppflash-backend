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

/** Hybrid-Suche nur mit Produkt-Anker: so viele Treffer, um Archiv-Dateien zu erkennen. */
const GAP_ANCHOR_PROBE_TOP_K = 15;
/** Max. Chunks im LLM-Kontext (Token-Sicherheit) nach Document-Level-Fetch. */
const GAP_DOCUMENT_CONTEXT_CHUNK_LIMIT = 30;
/** Obergrenze Zeilen beim `listChunksByFileNames` (alle Seiten der erkannten Dateien). */
const GAP_FULL_DOCUMENT_FETCH_MAX_ROWS = 10_000;

/** Stufe 2–4: Document-Level Gap-RAG (Anker-Vektorprobe → volle Archiv-Texte → ein LLM-Lauf). */
export interface RagGapTargetedRunInput {
  readonly tenantId: string;
  readonly productLabel: string;
  /** Fallback-Metadaten / Logging, wenn `missingFields` leer. */
  readonly gapSearchQuery: string;
  readonly anchorProductName: string;
  /** Fehlende Passport-Keys — ein LLM-Lauf extrahiert alle. */
  readonly missingFields: readonly string[];
  /** Ungenutzt im Document-Level-Pfad; optional für künftige Erweiterungen. */
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
   * Document-Level Gap-RAG:
   * 1) **Eine** Hybrid-Suche mit Query = allein `anchorProductName` (Top {@link GAP_ANCHOR_PROBE_TOP_K}),
   *    Primär-PDF per Basename entfernen → eindeutige Archiv-`fileName`.
   * 2) **Kein Vektor**: alle Chunks dieser Dateien für `tenantId` laden (`listChunksByFileNames`).
   * 3) Kontext auf {@link GAP_DOCUMENT_CONTEXT_CHUNK_LIMIT} Chunks kappen → ein Gap-LLM-Lauf für alle `missingFields`.
   *
   * @returns `null` wenn keine Archiv-Dokumente erkannt oder keine Chunks geladen werden.
   */
  async runGapTargetedEnrichment(input: RagGapTargetedRunInput): Promise<RagComplianceExtractionOutcome | null> {
    const anchor = input.anchorProductName.trim();
    const missingFields = input.missingFields;

    if (!anchor) {
      return null;
    }

    const primaryUploadPath =
      (input.excludePrimaryBasename?.trim() || input.sourceFileName?.trim()) ?? '';

    const retrievalProductEntityId = primaryUploadPath ? undefined : input.productEntityId;

    const probeHits = await this.retrieval.retrieveTopChunks({
      tenantId: input.tenantId,
      query: anchor,
      topK: GAP_ANCHOR_PROBE_TOP_K,
      productMatchTerms: undefined,
      sourceFileName: undefined,
      productEntityId: retrievalProductEntityId,
    });

    let probe = [...probeHits];
    if (primaryUploadPath) {
      const ex = basename(primaryUploadPath).toLowerCase();
      probe = probe.filter((c) => basename(c.fileName).toLowerCase() !== ex);
    }

    const uniqueArchiveFiles = [...new Set(probe.map((c) => c.fileName))];

    if (uniqueArchiveFiles.length === 0) {
      console.log('=== RAG DEBUG AUDIT (document-level gap) ===');
      console.log('1. Anker-Suche:', anchor, '| Probe-Treffer:', probeHits.length, '| Archiv-Dateien: 0');
      console.log('==================================================');
      return null;
    }

    let documentChunks = await this.retrieval.listChunksByFileNames({
      tenantId: input.tenantId,
      fileNames: uniqueArchiveFiles,
      maxRows: GAP_FULL_DOCUMENT_FETCH_MAX_ROWS,
    });

    if (documentChunks.length === 0) {
      const byFile = new Map<string, RetrievedChunk[]>();
      for (const c of probe) {
        const list = byFile.get(c.fileName) ?? [];
        list.push(c);
        byFile.set(c.fileName, list);
      }
      documentChunks = [...byFile.values()].flat().sort((a, b) => {
        const fn = a.fileName.localeCompare(b.fileName);
        if (fn !== 0) {
          return fn;
        }
        return a.pageNumber - b.pageNumber || a.id.localeCompare(b.id);
      });
    }

    const chunks = documentChunks.slice(0, GAP_DOCUMENT_CONTEXT_CHUNK_LIMIT);

    const gapSearchQueryForAgent =
      missingFields.length > 0
        ? `Produkt: ${anchor} | Archivdokumente: ${uniqueArchiveFiles.join(', ')} | Lückenfelder: ${missingFields.join(', ')}`
        : input.gapSearchQuery;

    const retrievalMatchConfidence = computeRetrievalMatchConfidence(
      chunks,
      input.productMatchTerms ?? [],
      input.sourceFileName,
    );

    console.log('=== RAG DEBUG AUDIT (document-level gap) ===');
    console.log(
      '1. Anker-Suche:',
      anchor,
      '| Probe-Treffer:',
      probeHits.length,
      '| Archiv-Dateien:',
      `${uniqueArchiveFiles.length}: ${uniqueArchiveFiles.join(', ')}`,
    );
    console.log(
      '2. Document-fetch Chunks:',
      documentChunks.length,
      '| ans LLM (cap):',
      chunks.length,
    );
    if (chunks.length > 0) {
      const t = chunks[0]!.text;
      console.log('3. Erster Kontext-Snippet:', t.substring(0, Math.min(200, t.length)));
    }
    console.log('==================================================');

    if (chunks.length === 0) {
      return null;
    }

    console.log('[Orchestrator] Starte LLM-Agent für Extraktion (Document-Level)…');
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
