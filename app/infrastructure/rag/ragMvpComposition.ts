import type { DocumentLayoutParserPort } from '@/app/application/ports/rag/DocumentLayoutParserPort';
import type { DocumentPrimaryProductNameInferencerPort } from '@/app/application/ports/rag/DocumentPrimaryProductNameInferencerPort';
import type { VectorStorePort } from '@/app/application/ports/rag/VectorStorePort';
import { DocumentIngestionService } from '@/app/application/services/rag/DocumentIngestionService';
import { HybridRetrievalService } from '@/app/application/services/rag/HybridRetrievalService';
import { ComplianceEnrichmentAgent } from '@/app/application/services/rag/ComplianceEnrichmentAgent';
import { ProductEntityService } from '@/app/application/services/rag/ProductEntityService';
import { RagComplianceOrchestrator } from '@/app/application/use-cases/rag/RagComplianceOrchestrator';
import { InMemoryVectorStore } from '@/app/infrastructure/rag/InMemoryVectorStore';
import { MockDocumentLayoutParser } from '@/app/infrastructure/rag/MockDocumentLayoutParser';
import { MockEmbeddingAdapter } from '@/app/infrastructure/rag/MockEmbeddingAdapter';
import { MockComplianceLlm } from '@/app/infrastructure/rag/MockComplianceLlm';
import { MockDocumentPrimaryProductNameInferencer } from '@/app/infrastructure/rag/MockDocumentPrimaryProductNameInferencer';
import { OpenAiTextEmbeddingAdapter } from '@/app/infrastructure/rag/OpenAiTextEmbeddingAdapter';
import { OpenAiComplianceLlm } from '@/app/infrastructure/rag/OpenAiComplianceLlm';
import { OpenAiDocumentPrimaryProductNameInferencer } from '@/app/infrastructure/rag/OpenAiDocumentPrimaryProductNameInferencer';

export interface RagMvpCompositionOptions {
  readonly vectorStore?: VectorStorePort;
  readonly layoutParser?: DocumentLayoutParserPort;
  readonly productEntityService?: ProductEntityService | null;
  readonly documentPrimaryProductNameInferencer?: DocumentPrimaryProductNameInferencerPort | null;
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

  const productEntityService = options?.productEntityService ?? null;
  const documentPrimaryProductNameInferencer =
    options?.documentPrimaryProductNameInferencer !== undefined
      ? options.documentPrimaryProductNameInferencer
      : process.env.OPENAI_API_KEY
        ? new OpenAiDocumentPrimaryProductNameInferencer()
        : new MockDocumentPrimaryProductNameInferencer();

  const ingestion = new DocumentIngestionService({
    layoutParser,
    embedder,
    vectorStore,
    productEntityService,
    documentPrimaryProductNameInferencer,
  });

  const retrieval = new HybridRetrievalService({
    embedder,
    vectorStore,
  });

  const enrichment = new ComplianceEnrichmentAgent(llm);

  return new RagComplianceOrchestrator(ingestion, retrieval, enrichment);
}
