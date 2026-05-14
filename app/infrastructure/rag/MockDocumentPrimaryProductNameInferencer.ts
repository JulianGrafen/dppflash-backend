import type { DocumentPrimaryProductNameInferencerPort } from '@/app/application/ports/rag/DocumentPrimaryProductNameInferencerPort';

/**
 * Offline stub: picks a short heuristic label from the excerpt (no network).
 */
export class MockDocumentPrimaryProductNameInferencer implements DocumentPrimaryProductNameInferencerPort {
  readonly name = 'MockDocumentPrimaryProductNameInferencer';

  async inferPrimaryProductName(documentTextExcerpt: string): Promise<string | null> {
    const lines = documentTextExcerpt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const hit = lines.find((l) => /produkt|bezeichnung|handelsname|artikel/i.test(l));
    const candidate = (hit ?? lines[0] ?? '').replace(/^.{0,40}?:\s*/i, '').trim();
    return candidate.length > 2 ? candidate.slice(0, 200) : null;
  }
}
