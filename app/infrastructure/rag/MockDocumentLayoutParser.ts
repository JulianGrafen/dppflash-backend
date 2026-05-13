import type { DocumentLayoutParserPort, LayoutTextBlock } from '@/app/application/ports/rag/DocumentLayoutParserPort';

/**
 * MVP stub: replace with Azure Document Intelligence layout analysis (tables, reading order).
 * See: https://learn.microsoft.com/azure/ai-services/document-intelligence/
 */
export class MockDocumentLayoutParser implements DocumentLayoutParserPort {
  readonly name = 'MockDocumentLayoutParser';

  async parsePdfLayout(_pdf: Buffer, fileName: string): Promise<readonly LayoutTextBlock[]> {
    return [{
      pageNumber: 1,
      text: [
        `[MOCK LAYOUT PARSER] File: ${fileName}`,
        'Integrate Azure Document Intelligence for layout-aware table extraction.',
        'Until then, downstream RAG uses this placeholder page for local testing.',
      ].join('\n\n'),
    }];
  }
}
