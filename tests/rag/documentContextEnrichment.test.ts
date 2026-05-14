import { describe, expect, it } from 'vitest';
import { enrichChunkTextWithProductContext } from '@/app/domain/rag/documentContextEnrichment';

describe('enrichChunkTextWithProductContext', () => {
  it('prepends the Kontext header with quoted product name', () => {
    const out = enrichChunkTextWithProductContext('Cimsec S1 Flex', 'Stahl 40 %');
    expect(out.startsWith('[Kontext: Dieses Text-Snippet gehört zum Dokument/Produkt: "Cimsec S1 Flex"]')).toBe(
      true,
    );
    expect(out).toContain('\n\nStahl 40 %');
  });

  it('escapes double quotes in the product name for the outer quotes', () => {
    const out = enrichChunkTextWithProductContext('Foo "Bar" Baz', 'x');
    expect(out).toContain(`"Foo 'Bar' Baz"`);
  });
});
