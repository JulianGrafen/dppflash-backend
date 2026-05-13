import { v4 as uuidv4 } from 'uuid';
import { buildSemanticChunks } from '@/app/domain/rag/semanticChunker';
import { tokenizeForRetrieval } from '@/app/domain/rag/textTokenize';
import type { DocumentLayoutParserPort } from '@/app/application/ports/rag/DocumentLayoutParserPort';
import type { EmbeddingPort } from '@/app/application/ports/rag/EmbeddingPort';
import type { VectorChunkRecord, VectorStorePort } from '@/app/application/ports/rag/VectorStorePort';

export interface DocumentIngestionDependencies {
  readonly layoutParser: DocumentLayoutParserPort;
  readonly embedder: EmbeddingPort;
  readonly vectorStore: VectorStorePort;
}

export interface IngestPdfInput {
  readonly tenantId: string;
  readonly fileName: string;
  readonly pdf: Buffer;
}

/**
 * Ingestion pipeline: layout parse → semantic chunk → embed → hybrid index upsert.
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

    const embeddings = await this.dependencies.embedder.embed(semanticChunks.map((c) => c.text));

    const records: VectorChunkRecord[] = semanticChunks.map((chunk, index) => ({
      id: uuidv4(),
      tenantId: input.tenantId,
      fileName: input.fileName,
      pageNumber: chunk.pageNumber,
      text: chunk.text,
      embedding: embeddings[index] ?? [],
      tokens: tokenizeForRetrieval(chunk.text),
    }));

    await this.dependencies.vectorStore.upsertChunks(records);

    return { chunkCount: records.length };
  }
}
