/**
 * Zwei-Stufen-DPP+RAG (Upload-Pipeline):
 * Primärdaten aus PDF-Extraktion → Lückenanalyse → programmatische Suchquery →
 * tenant-scopes Hybrid-Retrieval (Supabase `rag_chunks` / In-Memory) → sekundäres LLM → Merge.
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
