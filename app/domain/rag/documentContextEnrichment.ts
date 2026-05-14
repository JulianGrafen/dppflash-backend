const MAX_PRODUCT_NAME_IN_HEADER = 280;

/**
 * Stellt jedem Chunk einen kurzen Produkt-/Dokumentkontext voran, damit Embedding und BM25
 * auch auf späteren SDB-Seiten den semantischen Anker behalten (Context Amnesia).
 */
export function enrichChunkTextWithProductContext(
  productName: string,
  originalChunkText: string,
): string {
  const collapsed = productName.replace(/\s+/g, ' ').trim().replace(/"/g, "'");
  const label =
    collapsed.length > 0
      ? collapsed.slice(0, MAX_PRODUCT_NAME_IN_HEADER)
      : 'Unbekanntes Produkt';
  return `[Kontext: Dieses Text-Snippet gehört zum Dokument/Produkt: "${label}"]\n\n${originalChunkText}`;
}
