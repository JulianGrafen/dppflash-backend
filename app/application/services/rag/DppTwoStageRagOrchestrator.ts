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
  detectRagFillableGaps,
  resolvePrimaryProductNameAnchor,
} from '@/app/domain/rag/dppRagGapAnalysis';
