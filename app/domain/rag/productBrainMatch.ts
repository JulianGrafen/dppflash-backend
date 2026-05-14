import type { HybridSearchHit } from '@/app/application/ports/rag/VectorStorePort';
import { basename } from 'node:path';
import { tokenizeForRetrieval } from '@/app/domain/rag/textTokenize';

const STOPWORDS = new Set([
  'und',
  'oder',
  'der',
  'die',
  'das',
  'ein',
  'eine',
  'mit',
  'für',
  'von',
  'vom',
  'zum',
  'zur',
  'im',
  'am',
  'the',
  'and',
  'for',
  'with',
]);

function clamp01(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.min(1, n));
}

/** GTIN/EAN-style digit run (8–14) for cross-document retrieval. */
export function normalizeGtinDigitToken(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const d = value.replace(/\D/g, '');
  if (d.length >= 8 && d.length <= 14) {
    return d;
  }
  return undefined;
}

/**
 * Token set used for substring overlap against chunk text + fileName (RAG “brain” identity).
 */
export function buildProductMatchTerms(
  passport: Record<string, unknown>,
  productLabel: string,
): readonly string[] {
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) {
      parts.push(v.trim());
    }
  };

  push(productLabel);
  push(passport.productName);
  push(passport.hersteller);
  push(passport.modellname);
  push(passport.declaredProductType);
  const m = passport.manufacturer as { name?: string } | undefined;
  push(m?.name);

  const joined = parts.join(' ');
  const raw = tokenizeForRetrieval(joined);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    if (t.length < 2 || STOPWORDS.has(t)) {
      continue;
    }
    if (seen.has(t)) {
      continue;
    }
    seen.add(t);
    out.push(t);
    if (out.length >= 48) {
      break;
    }
  }

  const gtinTok = normalizeGtinDigitToken(passport.gtin);
  if (gtinTok && !seen.has(gtinTok)) {
    seen.add(gtinTok);
    out.unshift(gtinTok);
  }
  const eanTok = normalizeGtinDigitToken((passport as { ean?: unknown }).ean);
  if (eanTok && !seen.has(eanTok)) {
    seen.add(eanTok);
    out.unshift(eanTok);
  }

  return out.slice(0, 56);
}

/**
 * First lines of the retrieval query: dense product identity for embedding + BM25.
 */
export function buildProductIdentityQueryPrefix(
  passport: Record<string, unknown>,
  productLabel: string,
): string {
  const lines: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) {
      lines.push(v.trim());
    }
  };
  push(productLabel);
  push(passport.productName);
  push(passport.hersteller);
  push(passport.modellname);
  push(passport.gtin);
  push(passport.upi);
  const m = passport.manufacturer as { name?: string } | undefined;
  push(m?.name);
  const uniq: string[] = [];
  const s = new Set<string>();
  for (const l of lines) {
    const k = l.toLowerCase();
    if (!s.has(k)) {
      s.add(k);
      uniq.push(l);
    }
  }
  return uniq.join(' | ');
}

/**
 * Confidence that retrieved chunks belong to the same product line (token overlap + same PDF).
 */
export function computeRetrievalMatchConfidence(
  chunks: readonly Pick<HybridSearchHit, 'text' | 'fileName' | 'score'>[],
  matchTerms: readonly string[],
  sourceFileName?: string,
): number {
  if (chunks.length === 0) {
    return 0;
  }

  const meanScore = chunks.reduce((acc, c) => acc + c.score, 0) / chunks.length;

  if (matchTerms.length === 0) {
    return clamp01(meanScore);
  }

  let bestRatio = 0;
  let anySameFile = false;

  for (const c of chunks) {
    const hay = `${c.text} ${c.fileName}`.toLowerCase();
    let hits = 0;
    for (const t of matchTerms) {
      const n = t.toLowerCase();
      if (n.length < 2) {
        continue;
      }
      if (hay.includes(n)) {
        hits += 1;
      }
    }
    bestRatio = Math.max(bestRatio, hits / matchTerms.length);
    if (sourceFileName && basename(c.fileName) === basename(sourceFileName)) {
      anySameFile = true;
    }
  }

  const blended = 0.4 * meanScore + 0.5 * bestRatio + (anySameFile ? 0.1 : 0);
  return clamp01(blended);
}
