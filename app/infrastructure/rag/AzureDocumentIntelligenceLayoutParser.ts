import type { DocumentLayoutParserPort, LayoutTextBlock } from '@/app/application/ports/rag/DocumentLayoutParserPort';

/**
 * Production adapter (skeleton): wire Azure AI Document Intelligence layout + table extraction.
 *
 * Implementation outline:
 * - Upload PDF to Azure DI `prebuilt-layout` or custom model.
 * - Merge `paragraphs` + `tables` into reading-order `LayoutTextBlock[]` with stable `pageNumber`.
 * - Preserve table row text as single lines to keep GTIN/EAN columns intact for chunking.
 *
 * Environment (example):
 * - `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`
 * - `AZURE_DOCUMENT_INTELLIGENCE_KEY`
 */
export class AzureDocumentIntelligenceLayoutParser implements DocumentLayoutParserPort {
  readonly name = 'AzureDocumentIntelligenceLayoutParser';

  async parsePdfLayout(_pdf: Buffer, _fileName: string): Promise<readonly LayoutTextBlock[]> {
    throw new Error(
      'AzureDocumentIntelligenceLayoutParser is not implemented yet. '
      + 'Use MockDocumentLayoutParser for local MVP or implement REST calls to Azure DI.',
    );
  }
}
