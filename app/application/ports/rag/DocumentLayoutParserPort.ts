/**
 * Layout-aware parsing (Azure AI Document Intelligence).
 * Production: implement with @azure-rest/ai-document-intelligence or REST client.
 */
export interface LayoutTextBlock {
  readonly pageNumber: number;
  readonly text: string;
}

export interface DocumentLayoutParserPort {
  readonly name: string;

  /**
   * Extracts reading-order text grouped by page. Tables should remain row/column coherent
   * when the adapter supports layout (Azure DI "tables" → merged text rows).
   */
  parsePdfLayout(pdf: Buffer, fileName: string): Promise<readonly LayoutTextBlock[]>;
}
