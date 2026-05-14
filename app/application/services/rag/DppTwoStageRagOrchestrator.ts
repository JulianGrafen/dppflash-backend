/**
 * Zwei-Stufen-DPP+RAG (Upload-Pipeline):
 * Primärdaten aus PDF-Extraktion → Lückenanalyse → **Eager** `products.extracted_attributes` (kein Gap-LLM) → Merge.
 *
 * @see ProductPassportRagEnrichmentService.enrichFromIndexedChunks
 * @see RagComplianceOrchestrator.runGapTargetedEnrichment
 */
export { ProductPassportRagEnrichmentService } from './ProductPassportRagEnrichmentService';
export {
  buildGapTargetedSearchQuery,
  buildGermanGapSearchTerms,
  detectRagFillableGaps,
  mapGapFieldKeyToGermanSearchPhrase,
  RAG_GAP_SEMANTIC_FIELD_MAP,
  resolvePrimaryProductNameAnchor,
} from '@/app/domain/rag/dppRagGapAnalysis';
export { ProductEntityService } from '@/app/application/services/rag/ProductEntityService';
