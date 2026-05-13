export interface SemanticChunkInputPage {
  readonly pageNumber: number;
  readonly text: string;
}

export interface SemanticChunk {
  readonly text: string;
  readonly pageNumber: number;
}

const DEFAULT_MAX_CHARS = 900;
const DEFAULT_OVERLAP = 120;

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function windowText(text: string, maxChars: number, overlap: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const parts: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(text.length, start + maxChars);
    parts.push(text.slice(start, end).trim());

    if (end >= text.length) {
      break;
    }

    start = Math.max(end - overlap, start + 1);
  }

  return parts.filter((p) => p.length > 0);
}

/**
 * Layout-agnostic semantic chunker: paragraph boundaries first, then sliding windows.
 */
export function buildSemanticChunks(
  pages: readonly SemanticChunkInputPage[],
  options?: { readonly maxChars?: number; readonly overlap?: number },
): readonly SemanticChunk[] {
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;
  const overlap = options?.overlap ?? DEFAULT_OVERLAP;
  const chunks: SemanticChunk[] = [];

  for (const page of pages) {
    const paragraphs = splitParagraphs(page.text);

    for (const paragraph of paragraphs) {
      for (const slice of windowText(paragraph, maxChars, overlap)) {
        chunks.push({ text: slice, pageNumber: page.pageNumber });
      }
    }
  }

  return chunks;
}
