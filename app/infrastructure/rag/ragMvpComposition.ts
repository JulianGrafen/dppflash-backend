import type { DocumentLayoutParserPort } from '@/app/application/ports/rag/DocumentLayoutParserPort';
import type { DocumentPrimaryProductNameInferencerPort } from '@/app/application/ports/rag/DocumentPrimaryProductNameInferencerPort';
import type { VectorStorePort } from '@/app/application/ports/rag/VectorStorePort';
import { BackgroundExtractionAgent } from '@/app/application/services/rag/BackgroundExtractionAgent';
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
import { AzureOpenAiComplianceLlm } from '@/app/infrastructure/rag/AzureOpenAiComplianceLlm';
import { OpenAiTextEmbeddingAdapter } from '@/app/infrastructure/rag/OpenAiTextEmbeddingAdapter';
import { OpenAiComplianceLlm } from '@/app/infrastructure/rag/OpenAiComplianceLlm';
import { OpenAiDocumentPrimaryProductNameInferencer } from '@/app/infrastructure/rag/OpenAiDocumentPrimaryProductNameInferencer';
import { tryLoadAzureOpenAiComplianceChatConfig } from '@/app/infrastructure/azure/azureConfig';
import type { ComplianceLlmPort } from '@/app/application/ports/rag/ComplianceLlmPort';

export interface RagMvpCompositionOptions {
  readonly vectorStore?: VectorStorePort;
  readonly layoutParser?: DocumentLayoutParserPort;
  readonly productEntityService?: ProductEntityService | null;
  readonly documentPrimaryProductNameInferencer?: DocumentPrimaryProductNameInferencerPort | null;
  /** Override default compliance / gap-targeted LLM (e.g. tests). */
  readonly complianceLlm?: ComplianceLlmPort;
}

function createDefaultComplianceLlm(): ComplianceLlmPort {
  /** Azure zuerst: gleiche Umgebung wie DPP-Extraktion (gpt-4o-Deployment), vermeidet versehentlich OpenAI bei gesetzten Test-Keys. */
  const azureCompliance = tryLoadAzureOpenAiComplianceChatConfig();
  if (azureCompliance) {
    console.info('[RAG] Compliance LLM aktiv: AzureOpenAiComplianceLlm', {
      deployment: azureCompliance.deploymentName,
      model: azureCompliance.modelName,
      apiVersion: azureCompliance.apiVersion,
    });
    return new AzureOpenAiComplianceLlm(azureCompliance);
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    console.info('[RAG] Compliance LLM aktiv: OpenAiComplianceLlm (OPENAI_API_KEY)');
    return new OpenAiComplianceLlm();
  }

  const isVercelProduction = process.env.VERCEL_ENV === 'production';
  if (isVercelProduction) {
    throw new Error(
      '[RAG] Vercel Production: Gap-/Compliance-LLM erfordert Azure OpenAI (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT oder AZURE_OPENAI_COMPLIANCE_DEPLOYMENT) oder OPENAI_API_KEY. MockComplianceLlm ist hier deaktiviert.',
    );
  }

  console.warn(
    '[RAG] Compliance LLM: weder Azure OpenAI Chat-Env noch OPENAI_API_KEY gesetzt — MockComplianceLlm (offline, kein Netzwerk).',
  );
  return new MockComplianceLlm();
}

export function createRagComplianceOrchestrator(
  options?: RagMvpCompositionOptions,
): RagComplianceOrchestrator {
  const vectorStore = options?.vectorStore ?? new InMemoryVectorStore();
  const layoutParser = options?.layoutParser ?? new MockDocumentLayoutParser();

  const embedder = process.env.OPENAI_API_KEY
    ? new OpenAiTextEmbeddingAdapter()
    : new MockEmbeddingAdapter();

  const llm = options?.complianceLlm ?? createDefaultComplianceLlm();

  const productEntityService = options?.productEntityService ?? null;
  const backgroundExtractionAgent =
    productEntityService && llm.name !== 'MockComplianceLlm'
      ? new BackgroundExtractionAgent(llm)
      : null;

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
    backgroundExtractionAgent,
  });

  const retrieval = new HybridRetrievalService({
    embedder,
    vectorStore,
  });

  const enrichment = new ComplianceEnrichmentAgent(llm);

  return new RagComplianceOrchestrator(ingestion, retrieval, enrichment, productEntityService);
}
