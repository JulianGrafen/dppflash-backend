import { basename } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { ComplianceSourceDocument } from '@/app/domain/rag/sourceDocuments';
import { dedupeComplianceSourceDocuments } from '@/app/domain/rag/sourceDocuments';
import { uploadComplianceDocumentToStorage } from '@/app/infrastructure/rag/complianceDocumentStorage';
import { buildSemanticChunks } from '@/app/domain/rag/semanticChunker';
import { enrichChunkTextWithProductContext } from '@/app/domain/rag/documentContextEnrichment';
import { tokenizeForRetrieval } from '@/app/domain/rag/textTokenize';
import type { DocumentLayoutParserPort } from '@/app/application/ports/rag/DocumentLayoutParserPort';
import type { DocumentPrimaryProductNameInferencerPort } from '@/app/application/ports/rag/DocumentPrimaryProductNameInferencerPort';
import type { EmbeddingPort } from '@/app/application/ports/rag/EmbeddingPort';
import type { VectorChunkRecord, VectorStorePort } from '@/app/application/ports/rag/VectorStorePort';
import { ProductEntityService } from '@/app/application/services/rag/ProductEntityService';
import type { BackgroundExtractionAgent } from '@/app/application/services/rag/BackgroundExtractionAgent';
import type { ExtractedAttributeRow } from '@/app/domain/rag/extractedAttributesJson';
import { pickProductEntityAnchorFromExtracted } from '@/app/domain/rag/extractedAttributesJson';

export interface DocumentIngestionDependencies {
  readonly layoutParser: DocumentLayoutParserPort;
  readonly embedder: EmbeddingPort;
  readonly vectorStore: VectorStorePort;
  /** When set (Supabase path), chunks are linked to `products.id` for entity-centric retrieval. */
  readonly productEntityService?: ProductEntityService | null;
  /** Optional LLM pass on document excerpt when `primaryProductNameHint` is absent. */
  readonly documentPrimaryProductNameInferencer?: DocumentPrimaryProductNameInferencerPort | null;
  /**
   * Eager extraction: volles Dokument → strukturierte Keys in `products.extracted_attributes`
   * (Architektur: „product_knowledge“ / Gehirn vor Chunk-RAG).
   */
  readonly backgroundExtractionAgent?: BackgroundExtractionAgent | null;
}

export interface IngestPdfInput {
  readonly tenantId: string;
  readonly fileName: string;
  readonly pdf: Buffer;
  /**
   * DPP-Produkt-ID für Storage-Pfad `compliance-documents/{productId}/…`.
   * Ohne Angabe wird nur die Entity-ID aus dem Produkt-Anker verwendet (Archiv-Dokumente).
   */
  readonly productId?: string;
  /**
   * Skips document LLM when present (e.g. ESPR `productName` / `modellname` from primary extraction).
   */
  readonly primaryProductNameHint?: string;
  /** Optionaler Anzeigetitel für `sourceDocuments` (sonst aus Dateiname). */
  readonly documentTitleHint?: string;
}

export interface IngestPdfResult {
  readonly chunkCount: number;
  readonly productEntityId?: string;
  readonly sourceDocuments: readonly ComplianceSourceDocument[];
}

function inferFallbackProductLabelFromFileName(fileName: string): string {
  const base = basename(fileName).replace(/\.[^.]+$/i, '');
  const spaced = base.replace(/[-_]+/g, ' ').trim();
  return spaced.length > 0 ? spaced : 'product';
}

function buildFullDocumentText(
  layoutBlocks: readonly { readonly pageNumber: number; readonly text: string }[],
): string {
  return layoutBlocks
    .map((b) => `--- Seite ${b.pageNumber} ---\n${b.text}`)
    .join('\n\n')
    .slice(0, 120_000);
}

/**
 * Ingestion (Doc B/C Archiv + Doc A):
 *
 * 1. **Eager / Gehirn:** Ganzes PDF → LLM → `products.extracted_attributes` (Safe-Merge, Fuzzy-Key `normalized_name`).
 * 2. **Chunks:** Semantische Stücke + Embeddings (optional für andere RAG-Pfade; Gap-Fill nutzt Structured Keys).
 */
export class DocumentIngestionService {
  constructor(private readonly dependencies: DocumentIngestionDependencies) {}

  /**
   * Archiv-Pfad: strukturiertes Wissen extrahieren und unter normalisiertem Produkt-Key speichern.
   * Entspricht `product_knowledge.upsert({ normalized_name, attributes, source_file })`.
   */
  private async extractAndPersistProductKnowledge(params: {
    readonly tenantId: string;
    readonly fileName: string;
    readonly fullDocumentText: string;
    readonly productNameHint: string;
  }): Promise<{
    readonly productId: string;
    readonly extracted: Record<string, ExtractedAttributeRow>;
    readonly anchorUsed: string;
  }> {
    const { productEntityService, backgroundExtractionAgent } = this.dependencies;
    if (!productEntityService || !backgroundExtractionAgent) {
      throw new Error('extractAndPersistProductKnowledge requires productEntityService and backgroundExtractionAgent');
    }

    console.log('=== EAGER INGESTION START ===');
    console.log('1. Sende Dokument an LLM zur Voraus-Extraktion (ganzes PDF, kein Chunk-RAG)...');

    const extracted = await backgroundExtractionAgent.extractFromDocumentText({
      documentText: params.fullDocumentText,
      fileName: params.fileName,
      productNameHint: params.productNameHint,
    });

    console.log('2. LLM hat geantwortet! Extrahiertes JSON:', JSON.stringify(extracted, null, 2));

    const anchorUsed = pickProductEntityAnchorFromExtracted(extracted, params.productNameHint);

    const productId = await productEntityService.resolveOrCreateProduct(params.tenantId, anchorUsed);

    console.log('3. Speichere Safe-Merge in products.extracted_attributes (product_knowledge)...', {
      productId,
      anchorUsed,
      normalizedKeyHint: anchorUsed,
      sourceFile: params.fileName,
    });

    await productEntityService.mergeExtractedAttributes(productId, extracted);

    return { productId, extracted, anchorUsed };
  }

  /**
   * Speichert PDF in Supabase Storage und hängt Metadaten an `extracted_attributes.sourceDocuments` an.
   * Fehler beim Upload blockieren Text-Extraktion / Chunking nicht.
   */
  private async persistComplianceDocumentReference(params: {
    readonly productEntityId: string;
    readonly dppProductId?: string;
    readonly fileName: string;
    readonly pdf: Buffer;
    readonly titleHint?: string;
  }): Promise<ComplianceSourceDocument | null> {
    const storageProductKey = params.dppProductId?.trim() || params.productEntityId;
    const upload = await uploadComplianceDocumentToStorage({
      productId: storageProductKey,
      fileName: params.fileName,
      pdf: params.pdf,
      titleHint: params.titleHint,
    });

    if (!upload.ok) {
      return null;
    }

    const { productEntityService } = this.dependencies;
    if (productEntityService) {
      try {
        await productEntityService.appendSourceDocument(params.productEntityId, upload.document);
      } catch (err) {
        console.error('[DPP] append_source_document_failed', err);
      }
    }

    return upload.document;
  }

  async ingestPdf(input: IngestPdfInput): Promise<IngestPdfResult> {
    const layoutBlocks = await this.dependencies.layoutParser.parsePdfLayout(input.pdf, input.fileName);
    const pages = layoutBlocks.map((block) => ({
      pageNumber: block.pageNumber,
      text: block.text,
    }));

    const semanticChunks = buildSemanticChunks(pages);

    const sourceDocumentsCollected: ComplianceSourceDocument[] = [];

    if (semanticChunks.length === 0) {
      return { chunkCount: 0, sourceDocuments: sourceDocumentsCollected };
    }

    const excerptFirstPage = layoutBlocks
      .slice(0, 1)
      .map((b) => b.text)
      .join('\n\n')
      .slice(0, 12_000);

    let productAnchorLabel = input.primaryProductNameHint?.trim();
    if (!productAnchorLabel && this.dependencies.documentPrimaryProductNameInferencer) {
      productAnchorLabel =
        (await this.dependencies.documentPrimaryProductNameInferencer.inferPrimaryProductName(
          excerptFirstPage,
        ))?.trim() ?? '';
    }
    if (!productAnchorLabel) {
      productAnchorLabel = inferFallbackProductLabelFromFileName(input.fileName);
    }

    const fullDocumentText = buildFullDocumentText(layoutBlocks);

    let productId: string | null | undefined;

    // Phase 1 — Gehirn: Eager Extraction vor Chunking (Doc B/C und Doc A)
    if (this.dependencies.productEntityService && this.dependencies.backgroundExtractionAgent) {
      try {
        const knowledge = await this.extractAndPersistProductKnowledge({
          tenantId: input.tenantId,
          fileName: input.fileName,
          fullDocumentText,
          productNameHint: productAnchorLabel,
        });
        productId = knowledge.productId;
        productAnchorLabel = knowledge.anchorUsed;
      } catch (error) {
        console.error('!!! FATAL ERROR IN EAGER INGESTION !!!', error);
        const msg = error instanceof Error ? error.message : String(error);
        console.warn('[DPP] background_extracted_attributes_failed', msg);
        productId = await this.resolveProductEntityIdOrUndefined(input.tenantId, productAnchorLabel);
      }
    } else {
      console.log('[EAGER INGESTION] skipped (no productEntityService or backgroundExtractionAgent)', {
        hasProductEntityService: Boolean(this.dependencies.productEntityService),
        hasBackgroundExtractionAgent: Boolean(this.dependencies.backgroundExtractionAgent),
        tenantId: input.tenantId,
        fileName: input.fileName,
      });
      productId = await this.resolveProductEntityIdOrUndefined(input.tenantId, productAnchorLabel);
    }

    if (productId) {
      const docRef = await this.persistComplianceDocumentReference({
        productEntityId: productId,
        dppProductId: input.productId,
        fileName: input.fileName,
        pdf: input.pdf,
        titleHint: input.documentTitleHint ?? input.primaryProductNameHint,
      });
      if (docRef) {
        sourceDocumentsCollected.push(docRef);
      }
    }

    // Phase 2 — Chunk-Index (Retrieval; Lückenfüllung beim DPP nutzt Structured Key Lookup, nicht diese Chunks)
    const enrichedChunkTexts = semanticChunks.map((c) =>
      enrichChunkTextWithProductContext(productAnchorLabel, c.text),
    );

    const embeddings = await this.dependencies.embedder.embed(enrichedChunkTexts);

    const records: VectorChunkRecord[] = semanticChunks.map((chunk, index) => ({
      id: uuidv4(),
      tenantId: input.tenantId,
      productId: productId ?? null,
      fileName: input.fileName,
      pageNumber: chunk.pageNumber,
      text: enrichedChunkTexts[index] ?? enrichChunkTextWithProductContext(productAnchorLabel, chunk.text),
      embedding: embeddings[index] ?? [],
      tokens: tokenizeForRetrieval(
        enrichedChunkTexts[index] ?? enrichChunkTextWithProductContext(productAnchorLabel, chunk.text),
      ),
    }));

    await this.dependencies.vectorStore.upsertChunks(records);

    let sourceDocuments = sourceDocumentsCollected;
    if (productId && this.dependencies.productEntityService) {
      try {
        const fromDb = await this.dependencies.productEntityService.fetchSourceDocuments(productId);
        sourceDocuments = dedupeComplianceSourceDocuments([...sourceDocuments, ...fromDb]);
      } catch (err) {
        console.warn('[DPP] fetch_source_documents_after_ingest_failed', err);
      }
    }

    return {
      chunkCount: records.length,
      productEntityId: productId ?? undefined,
      sourceDocuments,
    };
  }

  private async resolveProductEntityIdOrUndefined(
    tenantId: string,
    rawLabel: string,
  ): Promise<string | undefined> {
    if (!this.dependencies.productEntityService) {
      return undefined;
    }
    try {
      return await this.dependencies.productEntityService.resolveOrCreateProduct(tenantId, rawLabel);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (ProductEntityService.isProductsEntitySchemaErrorMessage(msg)) {
        console.warn('[DPP] rag_products_table_missing; ingest ohne product_id', msg);
        return undefined;
      }
      throw err;
    }
  }
}
