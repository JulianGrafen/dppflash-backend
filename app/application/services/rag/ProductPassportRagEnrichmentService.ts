import type { RagComplianceOrchestrator } from '@/app/application/use-cases/rag/RagComplianceOrchestrator';
import type { ComplianceEnrichmentResult } from '@/app/application/services/rag/ComplianceEnrichmentAgent';
import {
  flattenProvenancePatchForPersistence,
  mergeRagAuditIntoPassport,
  type MergeRagAuditOptions,
} from '@/app/domain/rag/mergeRagAuditIntoPassport';
import {
  stripCryptoInvalidAuditedValues,
  validateAuditTrailCryptographically,
} from '@/app/domain/rag/auditTrailValidation';
import { safeParseAuditTrail } from '@/app/domain/rag/auditTrailSchema';
import { buildProductMatchTerms } from '@/app/domain/rag/productBrainMatch';
import {
  buildGapTargetedSearchQuery,
  detectRagFillableGaps,
  resolvePrimaryProductNameAnchor,
} from '@/app/domain/rag/dppRagGapAnalysis';
import {
  getRagTargetFieldKeysForProductType,
  orderRagTargetKeysPrioritizingGtin,
  RAG_SOURCES_AND_EVIDENCE_PASSPORT_KEYS,
} from '@/app/domain/rag/ragPassportFieldTargets';
import type { ProductPassport } from '@/app/types/dpp-types';

function emptyEnrichmentOutcome(): ComplianceEnrichmentResult {
  const emptyTrail = safeParseAuditTrail({ fields: {} });
  if (!emptyTrail.success) {
    throw new Error(emptyTrail.error.message);
  }
  const data = emptyTrail.data;
  return {
    auditTrail: data,
    rawModelJson: '{"fields":{}}',
    cryptoValidation: validateAuditTrailCryptographically(data),
  };
}

/**
 * Two-stage RAG (mandatory flow for upload):
 *
 * 1. Primary data = passport from PDF extraction (Doc A).
 * 2. Gap analysis vs RAG target keys; anchor = `productName` (abort secondary if missing).
 * 3. **Eager Gap-Fill**: `products.extracted_attributes` (tenant + normalisierter Produkt-Anker) — kein Live-LLM.
 * 4. Merge nur **genehmigte** leere Passport-Felder (siehe {@link RAG_SOURCES_AND_EVIDENCE_PASSPORT_KEYS}) mit Audit inkl. Quelle.
 */
export class ProductPassportRagEnrichmentService {
  async enrichFromIndexedChunks(
    orchestrator: RagComplianceOrchestrator,
    input: {
      readonly tenantId: string;
      readonly productType: ProductPassport['type'];
      readonly productLabel: string;
      readonly passport: ProductPassport;
      /** Indexed PDF basename; used to deprioritize Doc A when loading Doc B chunks. */
      readonly sourceFileName?: string;
      /** Canonical `products.id` from {@link ProductEntityService.findProductEntityId} (optional). */
      readonly productEntityId?: string;
    },
  ): Promise<{
    readonly passportPatch: Record<string, unknown>;
    readonly appliedKeys: readonly string[];
    readonly enrichment: ComplianceEnrichmentResult;
    readonly retrievalMatchConfidence: number;
    /** True when Stufe 2–4 ran (anchor + gaps present). */
    readonly ranTargetedGapRag: boolean;
  }> {
    const p = input.passport as Record<string, unknown>;
    const mergeAllowKeys = orderRagTargetKeysPrioritizingGtin(
      getRagTargetFieldKeysForProductType(input.productType),
      p,
    );

    const anchor = resolvePrimaryProductNameAnchor(p);
    const gaps = detectRagFillableGaps(p, input.productType);
    const ragEvidenceGaps = gaps.filter((key) => RAG_SOURCES_AND_EVIDENCE_PASSPORT_KEYS.has(key));

    if (!anchor || gaps.length === 0) {
      const enrichment = emptyEnrichmentOutcome();
      const trailForMerge = stripCryptoInvalidAuditedValues(enrichment.auditTrail);
      const { patch, appliedKeys } = mergeRagAuditIntoPassport(
        input.passport,
        trailForMerge,
        mergeAllowKeys,
      );
      const passportPatch = flattenProvenancePatchForPersistence(patch);
      return {
        passportPatch,
        appliedKeys,
        enrichment,
        retrievalMatchConfidence: 0,
        ranTargetedGapRag: false,
      };
    }

    if (ragEvidenceGaps.length === 0) {
      console.info('[DPP] rag_sources_evidence_skip', {
        reason: 'no_whitelisted_gaps',
        gapKeys: gaps,
        ragEvidenceWhitelist: [...RAG_SOURCES_AND_EVIDENCE_PASSPORT_KEYS],
      });
      const enrichment = emptyEnrichmentOutcome();
      const trailForMerge = stripCryptoInvalidAuditedValues(enrichment.auditTrail);
      const { patch, appliedKeys } = mergeRagAuditIntoPassport(
        input.passport,
        trailForMerge,
        mergeAllowKeys,
      );
      const passportPatch = flattenProvenancePatchForPersistence(patch);
      return {
        passportPatch,
        appliedKeys,
        enrichment,
        retrievalMatchConfidence: 0,
        ranTargetedGapRag: false,
      };
    }

    const gapQuery = buildGapTargetedSearchQuery(ragEvidenceGaps, anchor);
    const matchTerms = buildProductMatchTerms(p, input.productLabel);

    console.info('[DPP] rag_two_stage_gap', {
      tenantId: input.tenantId,
      anchor,
      gapCountAll: gaps.length,
      ragEvidenceGapCount: ragEvidenceGaps.length,
      ragEvidenceGaps,
      gapQueryPreview: gapQuery.slice(0, 200),
    });

    const gapOutcome = await orchestrator.runGapTargetedEnrichment({
      tenantId: input.tenantId,
      productLabel: input.productLabel,
      gapSearchQuery: gapQuery,
      anchorProductName: anchor,
      missingFields: [...ragEvidenceGaps],
      productMatchTerms: matchTerms,
      sourceFileName: input.sourceFileName,
      excludePrimaryBasename: input.sourceFileName,
      retrievalTopK: Math.min(36, 14 + ragEvidenceGaps.length),
      productEntityId: input.productEntityId,
    });

    let enrichment: ComplianceEnrichmentResult;
    let retrievalMatchConfidence: number;
    if (gapOutcome === null) {
      console.warn('[DPP] rag_gap_eager_miss; kein Treffer in products.extracted_attributes (oder Service fehlt)');
      enrichment = emptyEnrichmentOutcome();
      retrievalMatchConfidence = 0;
    } else {
      enrichment = gapOutcome.enrichment;
      retrievalMatchConfidence = gapOutcome.retrievalMatchConfidence;
    }

    const mergeAllowKeysRagEvidence = ragEvidenceGaps.filter((key) =>
      RAG_SOURCES_AND_EVIDENCE_PASSPORT_KEYS.has(key),
    );

    const trailForMerge = stripCryptoInvalidAuditedValues(enrichment.auditTrail);
    const mergeOpts: MergeRagAuditOptions | undefined =
      gapOutcome !== null ? { fieldShape: 'provenance' } : undefined;
    const { patch, appliedKeys } = mergeRagAuditIntoPassport(
      input.passport,
      trailForMerge,
      mergeAllowKeysRagEvidence,
      mergeOpts,
    );

    const passportPatch = flattenProvenancePatchForPersistence(patch);

    const dppPreview = { ...p, ...passportPatch } as Record<string, unknown>;
    const mz = dppPreview.materialZusammensetzung ?? dppPreview.zusammensetzung;
    console.log('Synthese abgeschlossen. Material-/Zusammensetzung (Kernfeld): ', mz);

    return {
      passportPatch,
      appliedKeys,
      enrichment,
      retrievalMatchConfidence,
      ranTargetedGapRag: true,
    };
  }
}
