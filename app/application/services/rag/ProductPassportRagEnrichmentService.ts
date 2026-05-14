import type { RagComplianceOrchestrator } from '@/app/application/use-cases/rag/RagComplianceOrchestrator';
import type { ComplianceEnrichmentResult } from '@/app/application/services/rag/ComplianceEnrichmentAgent';
import { mergeRagAuditIntoPassport } from '@/app/domain/rag/mergeRagAuditIntoPassport';
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
 * 3. Build search query: missing fields + anchor.
 * 4. Tenant-scoped hybrid retrieval (Supabase `rag_chunks` or in-process); prefer chunks from other PDFs than Doc A.
 * 5. Secondary LLM (gap-targeted system prompt) → merge into empty passport fields only.
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

    if (!anchor || gaps.length === 0) {
      const enrichment = emptyEnrichmentOutcome();
      const trailForMerge = stripCryptoInvalidAuditedValues(enrichment.auditTrail);
      const { patch, appliedKeys } = mergeRagAuditIntoPassport(
        input.passport,
        trailForMerge,
        mergeAllowKeys,
      );
      return {
        passportPatch: patch,
        appliedKeys,
        enrichment,
        retrievalMatchConfidence: 0,
        ranTargetedGapRag: false,
      };
    }

    const gapQuery = buildGapTargetedSearchQuery(gaps, anchor);
    const matchTerms = buildProductMatchTerms(p, input.productLabel);

    console.info('[DPP] rag_two_stage_gap', {
      tenantId: input.tenantId,
      anchor,
      gapCount: gaps.length,
      gapQueryPreview: gapQuery.slice(0, 200),
    });

    const gapOutcome = await orchestrator.runGapTargetedEnrichment({
      tenantId: input.tenantId,
      productLabel: input.productLabel,
      gapSearchQuery: gapQuery,
      anchorProductName: anchor,
      targetPassportFieldKeys: [...gaps],
      productMatchTerms: matchTerms,
      sourceFileName: input.sourceFileName,
      excludePrimaryBasename: input.sourceFileName,
      retrievalTopK: Math.min(36, 14 + gaps.length),
      productEntityId: input.productEntityId,
    });

    let enrichment: ComplianceEnrichmentResult;
    let retrievalMatchConfidence: number;
    if (gapOutcome === null) {
      console.warn('[DPP] rag_gap_targeted_no_chunks; LLM übersprungen (Retrieval leer)');
      enrichment = emptyEnrichmentOutcome();
      retrievalMatchConfidence = 0;
    } else {
      enrichment = gapOutcome.enrichment;
      retrievalMatchConfidence = gapOutcome.retrievalMatchConfidence;
    }

    const trailForMerge = stripCryptoInvalidAuditedValues(enrichment.auditTrail);
    const { patch, appliedKeys } = mergeRagAuditIntoPassport(
      input.passport,
      trailForMerge,
      mergeAllowKeys,
    );

    return {
      passportPatch: patch,
      appliedKeys,
      enrichment,
      retrievalMatchConfidence,
      ranTargetedGapRag: true,
    };
  }
}
