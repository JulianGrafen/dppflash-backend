import type { DocumentLayoutParserPort } from '@/app/application/ports/rag/DocumentLayoutParserPort';
import type { VectorStorePort } from '@/app/application/ports/rag/VectorStorePort';
import { DocumentIngestionService } from '@/app/application/services/rag/DocumentIngestionService';
import { HybridRetrievalService } from '@/app/application/services/rag/HybridRetrievalService';
import { ComplianceEnrichmentAgent } from '@/app/application/services/rag/ComplianceEnrichmentAgent';
import { RagComplianceOrchestrator } from '@/app/application/use-cases/rag/RagComplianceOrchestrator';
import { InMemoryVectorStore } from '@/app/infrastructure/rag/InMemoryVectorStore';
import { MockDocumentLayoutParser } from '@/app/infrastructure/rag/MockDocumentLayoutParser';
import { MockEmbeddingAdapter } from '@/app/infrastructure/rag/MockEmbeddingAdapter';
import { MockComplianceLlm } from '@/app/infrastructure/rag/MockComplianceLlm';
import { OpenAiTextEmbeddingAdapter } from '@/app/infrastructure/rag/OpenAiTextEmbeddingAdapter';
import { OpenAiComplianceLlm } from '@/app/infrastructure/rag/OpenAiComplianceLlm';

export interface RagMvpCompositionOptions {
  readonly vectorStore?: VectorStorePort;
  readonly layoutParser?: DocumentLayoutParserPort;
}

export function createRagComplianceOrchestrator(
  options?: RagMvpCompositionOptions,
): RagComplianceOrchestrator {
  const vectorStore = options?.vectorStore ?? new InMemoryVectorStore();
  const layoutParser = options?.layoutParser ?? new MockDocumentLayoutParser();

  const embedder = process.env.OPENAI_API_KEY
    ? new OpenAiTextEmbeddingAdapter()
    : new MockEmbeddingAdapter();

  const llm = process.env.OPENAI_API_KEY
    ? new OpenAiComplianceLlm()
    : new MockComplianceLlm();

  const ingestion = new DocumentIngestionService({
    layoutParser,
    embedder,
    vectorStore,
  });

  const retrieval = new HybridRetrievalService({
    embedder,
    vectorStore,
  });

  const enrichment = new ComplianceEnrichmentAgent(llm);

  return new RagComplianceOrchestrator(ingestion, retrieval, enrichment);
}
