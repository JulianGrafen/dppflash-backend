import { basename } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { buildSemanticChunks } from '@/app/domain/rag/semanticChunker';
import { enrichChunkTextWithProductContext } from '@/app/domain/rag/documentContextEnrichment';
import { tokenizeForRetrieval } from '@/app/domain/rag/textTokenize';
import type { DocumentLayoutParserPort } from '@/app/application/ports/rag/DocumentLayoutParserPort';
import type { DocumentPrimaryProductNameInferencerPort } from '@/app/application/ports/rag/DocumentPrimaryProductNameInferencerPort';
import type { EmbeddingPort } from '@/app/application/ports/rag/EmbeddingPort';
import type { VectorChunkRecord, VectorStorePort } from '@/app/application/ports/rag/VectorStorePort';
import { ProductEntityService } from '@/app/application/services/rag/ProductEntityService';

export interface DocumentIngestionDependencies {
  readonly layoutParser: DocumentLayoutParserPort;
  readonly embedder: EmbeddingPort;
  readonly vectorStore: VectorStorePort;
  /** When set (Supabase path), chunks are linked to `products.id` for entity-centric retrieval. */
  readonly productEntityService?: ProductEntityService | null;
  /** Optional LLM pass on document excerpt when `primaryProductNameHint` is absent. */
  readonly documentPrimaryProductNameInferencer?: DocumentPrimaryProductNameInferencerPort | null;
}

export interface IngestPdfInput {
  readonly tenantId: string;
  readonly fileName: string;
  readonly pdf: Buffer;
  /**
   * Skips document LLM when present (e.g. ESPR `productName` / `modellname` from primary extraction).
   */
  readonly primaryProductNameHint?: string;
}

function inferFallbackProductLabelFromFileName(fileName: string): string {
  const base = basename(fileName).replace(/\.[^.]+$/i, '');
  const spaced = base.replace(/[-_]+/g, ' ').trim();
  return spaced.length > 0 ? spaced : 'product';
}

/**
 * Ingestion pipeline: layout parse → semantische Chunks → **Kontext-Anreicherung pro Chunk** (Produktname)
 * → (optional) Product-Entity → **Embedding aus angereichertem Text** → Hybrid-Index upsert.
 */
export class DocumentIngestionService {
  constructor(private readonly dependencies: DocumentIngestionDependencies) {}

  async ingestPdf(input: IngestPdfInput): Promise<{ readonly chunkCount: number }> {
    const layoutBlocks = await this.dependencies.layoutParser.parsePdfLayout(input.pdf, input.fileName);
    const pages = layoutBlocks.map((block) => ({
      pageNumber: block.pageNumber,
      text: block.text,
    }));

    const semanticChunks = buildSemanticChunks(pages);

    if (semanticChunks.length === 0) {
      return { chunkCount: 0 };
    }

    const excerptFirstPage = layoutBlocks
      .slice(0, 1)
      .map((b) => b.text)
      .join('\n\n')
      .slice(0, 12_000);

    let rawLabel = input.primaryProductNameHint?.trim();
    if (!rawLabel && this.dependencies.documentPrimaryProductNameInferencer) {
      rawLabel =
        (await this.dependencies.documentPrimaryProductNameInferencer.inferPrimaryProductName(
          excerptFirstPage,
        ))?.trim() ?? '';
    }
    if (!rawLabel) {
      rawLabel = inferFallbackProductLabelFromFileName(input.fileName);
    }

    let productId: string | null | undefined;
    if (this.dependencies.productEntityService) {
      try {
        productId = await this.dependencies.productEntityService.resolveOrCreateProduct(
          input.tenantId,
          rawLabel,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (ProductEntityService.isProductsEntitySchemaErrorMessage(msg)) {
          console.warn(
            '[DPP] rag_products_table_missing; ingest ohne product_id (Migration ausführen?)',
            msg,
          );
          productId = undefined;
        } else {
          throw err;
        }
      }
    }

    const productNameForContext = rawLabel;

    const enrichedChunkTexts = semanticChunks.map((c) =>
      enrichChunkTextWithProductContext(productNameForContext, c.text),
    );

    const embeddings = await this.dependencies.embedder.embed(enrichedChunkTexts);

    const records: VectorChunkRecord[] = semanticChunks.map((chunk, index) => ({
      id: uuidv4(),
      tenantId: input.tenantId,
      productId: productId ?? null,
      fileName: input.fileName,
      pageNumber: chunk.pageNumber,
      text: enrichedChunkTexts[index] ?? enrichChunkTextWithProductContext(productNameForContext, chunk.text),
      embedding: embeddings[index] ?? [],
      tokens: tokenizeForRetrieval(
        enrichedChunkTexts[index] ?? enrichChunkTextWithProductContext(productNameForContext, chunk.text),
      ),
    }));

    await this.dependencies.vectorStore.upsertChunks(records);

    return { chunkCount: records.length };
  }
}
