import type { ComplianceLlmPort } from '@/app/application/ports/rag/ComplianceLlmPort';
import type { AuditedValue } from '@/app/domain/rag/auditTrailSchema';
import { findFirstEuropeanWasteCodeInText } from '@/app/application/services/wasteCodeTextScan';
import { isValidGtinDigits } from '@/app/domain/rag/gtinProof';

type ChunkRow = {
  readonly metadata?: { readonly fileName?: string; readonly pageNumber?: number };
  readonly text?: string;
};

function tryParseChunksFromPrompt(userPrompt: string): readonly ChunkRow[] {
  const marker = '\n\nchunks:\n';
  const idx = userPrompt.indexOf(marker);
  if (idx === -1) {
    return [];
  }
  const jsonPart = userPrompt.slice(idx + marker.length).trim();
  try {
    const parsed = JSON.parse(jsonPart) as unknown;
    return Array.isArray(parsed) ? (parsed as ChunkRow[]) : [];
  } catch {
    return [];
  }
}

function parseTargetKeys(userPrompt: string): readonly string[] {
  const m = userPrompt.match(/targetPassportFieldKeys:\s*([^\n]+)/);
  if (!m?.[1]) {
    return [];
  }
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function auditedFromChunk(
  value: string,
  fileName: string,
  pageNumber: number,
  snippet: string,
): AuditedValue {
  return {
    value,
    confidence: 0.55,
    source: { fileName, pageNumber, contextSnippet: snippet },
    requiresManualReview: false,
  };
}

/**
 * Offline LLM: when chunks are present, deterministically lifts EWC/EAK and GTIN from chunk text
 * so RAG enrichment still produces provenance without OpenAI. Returns `{}` when no chunks.
 */
export class MockComplianceLlm implements ComplianceLlmPort {
  readonly name = 'MockComplianceLlm';

  async completeJson(_systemPrompt: string, userPrompt: string): Promise<string> {
    const chunks = tryParseChunksFromPrompt(userPrompt);
    if (chunks.length === 0) {
      return JSON.stringify({});
    }

    const keys = parseTargetKeys(userPrompt);
    const fields: Record<string, AuditedValue> = {};

    const wantWaste = keys.some((k) => k === 'wasteCode' || k === 'ewcCode');
    const wantGtin = keys.some((k) => k === 'gtin' || k === 'ean');

    if (wantGtin) {
      for (const row of chunks) {
        const text = typeof row.text === 'string' ? row.text : '';
        const fn = row.metadata?.fileName;
        const pn = row.metadata?.pageNumber;
        if (!text || typeof fn !== 'string' || typeof pn !== 'number') {
          continue;
        }
        const re = /\b(\d{8}|\d{12}|\d{13}|\d{14})\b/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          const candidate = m[1] ?? m[0];
          if (!isValidGtinDigits(candidate)) {
            continue;
          }
          fields.gtin = auditedFromChunk(candidate, fn, pn, candidate);
          break;
        }
        if (fields.gtin) {
          break;
        }
      }
    }

    if (wantWaste) {
      for (const row of chunks) {
        const text = typeof row.text === 'string' ? row.text : '';
        const fn = row.metadata?.fileName;
        const pn = row.metadata?.pageNumber;
        if (!text || typeof fn !== 'string' || typeof pn !== 'number') {
          continue;
        }
        const hit = findFirstEuropeanWasteCodeInText(text);
        if (!hit) {
          continue;
        }
        const audited = auditedFromChunk(hit.normalizedValue, fn, pn, hit.snippet);
        if (keys.includes('wasteCode')) {
          fields.wasteCode = audited;
        }
        if (keys.includes('ewcCode')) {
          fields.ewcCode = audited;
        }
        break;
      }
    }

    return JSON.stringify(Object.keys(fields).length > 0 ? { fields } : {});
  }
}
