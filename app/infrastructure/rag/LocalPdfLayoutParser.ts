import type { DocumentLayoutParserPort, LayoutTextBlock } from '@/app/application/ports/rag/DocumentLayoutParserPort';
import { readPdfPerPage } from '@/app/utils/pdfReader';

/**
 * Server-side PDF text extraction (pdfjs per page, fallback to {@link readPdf}).
 * For layout/tables in production, prefer {@link AzureDocumentIntelligenceLayoutParser}.
 */
export class LocalPdfLayoutParser implements DocumentLayoutParserPort {
  readonly name = 'LocalPdfLayoutParser';

  async parsePdfLayout(pdf: Buffer, fileName: string): Promise<readonly LayoutTextBlock[]> {
    const pages = await readPdfPerPage(pdf, fileName);
    return pages
      .filter((p) => p.text.length > 0)
      .map((p) => ({
        pageNumber: p.pageNumber,
        text: p.text,
      }));
  }
}
