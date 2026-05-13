import { partial_ratio, ratio } from 'fuzzball';

const WEIGHT_NAME = 0.5;
const WEIGHT_TOKEN_OVERLAP = 0.3;
const WEIGHT_SEMANTIC = 0.2;

const MATCH_THRESHOLD = 0.8;
const REVIEW_UPPER_INCLUSIVE = 0.95;

const MANUFACTURER_LABEL =
  /(?:Hersteller|Fabrikant|Lieferant|Manufacturer|Supplier|Hergestellt von|Manufactured by)\s*:\s*([^\n\r|]{2,200})/gi;

const LEGAL_FORM =
  /\b(?:GmbH|GmbH\s*&\s*Co\.?\s*KG|AG|SE|KG|UG|e\.?\s*V\.|Inc\.?|LLC|Ltd\.?|Corp\.?|S\.A\.|B\.V\.|N\.V\.)\b/i;

const STOPWORDS = new Set([
  'und',
  'oder',
  'für',
  'mit',
  'von',
  'der',
  'die',
  'das',
  'ein',
  'eine',
  'the',
  'and',
  'for',
  'with',
]);

export interface AnchorProduct {
  readonly name: string;
  readonly manufacturer: string;
}

export interface CandidateChunkMetadata {
  /** Normalized semantic / hybrid score in [0, 1] from the vector store. */
  readonly semanticScore?: number;
  readonly vectorScore?: number;
  readonly score?: number;
  readonly [key: string]: unknown;
}

export interface CandidateChunkInput {
  readonly text: string;
  readonly metadata: CandidateChunkMetadata;
}

export interface EntityResolutionResult {
  readonly isMatch: boolean;
  readonly confidence: number;
  readonly requiresReview: boolean;
  readonly matchReason: string;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function normalizeComparable(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9äöüß\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Splits chunk into coarse windows so short product names can be compared to local context
 * (not only the entire SDS as one string).
 */
function buildChunkWindows(chunkText: string, maxWindows = 48): readonly string[] {
  const trimmed = chunkText.trim();
  if (!trimmed) {
    return [];
  }

  const byParagraph = trimmed
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const windows: string[] = [...byParagraph];

  const lineGroups: string[] = [];
  const lines = trimmed.split(/\n/).map((l) => l.trim());
  for (let i = 0; i < lines.length; i += 4) {
    lineGroups.push(lines.slice(i, i + 6).join(' '));
  }
  windows.push(...lineGroups);

  if (trimmed.length <= 400) {
    windows.push(trimmed);
  } else {
    const step = 220;
    for (let i = 0; i < trimmed.length && windows.length < maxWindows; i += step) {
      windows.push(trimmed.slice(i, i + 400));
    }
  }

  const deduped = [...new Set(windows.map((w) => w.trim()).filter((w) => w.length > 3))];
  return deduped.slice(0, maxWindows);
}

/**
 * Fuzzball-based similarity of anchor product name against the most similar chunk window,
 * plus partial match against full text (captures embedded product strings).
 */
function computeNameSimilarityScore(anchorName: string, chunkText: string): number {
  const name = anchorName.trim();
  if (!name) {
    return 0;
  }

  const windows = buildChunkWindows(chunkText);
  let best = 0;

  for (const w of windows) {
    const r = ratio(name, w) / 100;
    if (r > best) {
      best = r;
    }
  }

  const partialFull = partial_ratio(name, chunkText) / 100;
  return clamp01(Math.max(best, partialFull));
}

function tokenizeProductNameWords(anchorName: string): readonly string[] {
  return normalizeComparable(anchorName)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Share of significant product-name tokens that occur as whole words in the chunk.
 */
function computeTokenOverlapScore(anchorName: string, chunkText: string): number {
  const words = tokenizeProductNameWords(anchorName);
  if (words.length === 0) {
    return 0;
  }

  const haystack = chunkText.toLowerCase();
  let hits = 0;

  for (const w of words) {
    const pattern = new RegExp(`\\b${escapeRegExp(w)}\\b`, 'iu');
    if (pattern.test(haystack)) {
      hits += 1;
    }
  }

  return clamp01(hits / words.length);
}

function pickSemanticRaw(metadata: CandidateChunkMetadata): number | undefined {
  const candidates = [metadata.semanticScore, metadata.vectorScore, metadata.score];
  for (const v of candidates) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      return v;
    }
  }
  return undefined;
}

/**
 * Maps store scores to [0, 1]. Accepts already-normalized floats or legacy 0–100 integers.
 */
function computeSemanticComponent(metadata: CandidateChunkMetadata): number {
  const raw = pickSemanticRaw(metadata);
  if (raw === undefined) {
    return 0;
  }
  if (raw > 1 && raw <= 100) {
    return clamp01(raw / 100);
  }
  return clamp01(raw);
}

function cleanupManufacturerSegment(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/[,;|]+$/g, '').trim();
}

function extractManufacturerClaims(chunkText: string): readonly string[] {
  const out: string[] = [];
  const re = new RegExp(MANUFACTURER_LABEL.source, MANUFACTURER_LABEL.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(chunkText)) !== null) {
    const segment = cleanupManufacturerSegment(match[1] ?? '');
    if (segment.length >= 3) {
      out.push(segment);
    }
  }
  return out;
}

function looksLikeOrganizationName(segment: string): boolean {
  if (segment.length >= 14) {
    return true;
  }
  return LEGAL_FORM.test(segment);
}

/**
 * Hard KO: known anchor manufacturer, but an explicit manufacturer line names a different org.
 */
function isManufacturerConflict(anchorManufacturer: string, chunkText: string): boolean {
  const anchor = anchorManufacturer.trim();
  if (!anchor) {
    return false;
  }

  const claims = extractManufacturerClaims(chunkText);
  if (claims.length === 0) {
    return false;
  }

  const anchorNorm = normalizeComparable(anchor);

  for (const claim of claims) {
    if (!looksLikeOrganizationName(claim)) {
      continue;
    }

    const claimNorm = normalizeComparable(claim);
    if (claimNorm.length < 4) {
      continue;
    }

    const sim = ratio(anchorNorm, claimNorm) / 100;
    const partial = partial_ratio(anchorNorm, claimNorm) / 100;
    const best = Math.max(sim, partial);

    if (best < 0.42) {
      return true;
    }
  }

  return false;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function buildMatchReason(params: {
  readonly confidence: number;
  readonly nameScore: number;
  readonly tokenScore: number;
  readonly semanticScore: number;
  readonly hardKo: boolean;
}): string {
  if (params.hardKo) {
    return 'Hard-K.O.: Expliziter Hersteller im Chunk weicht vom Anker-Hersteller ab.';
  }

  return [
    `Gewichteter Score ${(params.confidence * 100).toFixed(1)}%`,
    `(Name ${(params.nameScore * 100).toFixed(0)}% × ${WEIGHT_NAME},`,
    `Token-Overlap ${(params.tokenScore * 100).toFixed(0)}% × ${WEIGHT_TOKEN_OVERLAP},`,
    `Semantik ${(params.semanticScore * 100).toFixed(0)}% × ${WEIGHT_SEMANTIC}).`,
  ].join(' ');
}

/**
 * Bewertet, ob ein RAG-Chunk zum Ankerprodukt (z. B. aus SDB) passt — kombiniert
 * String-Ähnlichkeit, Token-Overlap und semantischen Retriever-Score.
 */
export class EntityResolutionService {
  scoreCandidate(anchorProduct: AnchorProduct, candidateChunk: CandidateChunkInput): EntityResolutionResult {
    const hardKo = isManufacturerConflict(anchorProduct.manufacturer, candidateChunk.text);

    if (hardKo) {
      return {
        isMatch: false,
        confidence: 0,
        requiresReview: false,
        matchReason: buildMatchReason({
          confidence: 0,
          nameScore: 0,
          tokenScore: 0,
          semanticScore: 0,
          hardKo: true,
        }),
      };
    }

    const nameScore = computeNameSimilarityScore(anchorProduct.name, candidateChunk.text);
    const tokenScore = computeTokenOverlapScore(anchorProduct.name, candidateChunk.text);
    const semanticScore = computeSemanticComponent(candidateChunk.metadata);

    const confidence = round4(
      WEIGHT_NAME * nameScore + WEIGHT_TOKEN_OVERLAP * tokenScore + WEIGHT_SEMANTIC * semanticScore,
    );

    const isMatch = confidence > MATCH_THRESHOLD;
    const requiresReview = isMatch && confidence <= REVIEW_UPPER_INCLUSIVE;

    return {
      isMatch,
      confidence,
      requiresReview,
      matchReason: buildMatchReason({
        confidence,
        nameScore,
        tokenScore,
        semanticScore,
        hardKo: false,
      }),
    };
  }
}
