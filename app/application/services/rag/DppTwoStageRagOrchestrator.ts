/**
 * Zwei-Stufen-DPP+RAG (Upload-Pipeline):
 * Primärdaten aus PDF-Extraktion → Lückenanalyse → **pro fehlendem Feld** Hybrid-Retrieval (`retrieveTopChunks`) → sekundäres LLM → Merge.
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
