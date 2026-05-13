import type { ComplianceLlmPort } from '@/app/application/ports/rag/ComplianceLlmPort';
import type { RetrievedChunk } from '@/app/application/services/rag/HybridRetrievalService';
import { safeParseAuditTrail, type AuditTrail, type AuditedValue } from '@/app/domain/rag/auditTrailSchema';
import { validateAuditTrailCryptographically } from '@/app/domain/rag/auditTrailValidation';

const FORENSIC_CORE = `Du bist ein forensischer Daten-Auditor. Beantworte die Frage AUSSCHLIESSLICH basierend auf dem bereitgestellten Kontext (Chunks). Wenn die Antwort nicht im Kontext steht, gib null zurück. Erfinde niemals Daten. Zitiere für jeden Wert exakt den 'contextSnippet', die 'pageNumber' und den 'fileName' aus den Metadaten des Chunks.

Regeln:
- Nutze nur Informationen, die wörtlich oder eindeutig aus dem Chunk-Text folgen.
- Wenn mehrere Chunks widersprüchlich sind: setze requiresManualReview auf true und value auf null.
- Lasse Felder weg, wenn es keine belastbare Information gibt (nicht raten).`;

function buildSystemPrompt(targetPassportFieldKeys?: readonly string[]): string {
  if (targetPassportFieldKeys && targetPassportFieldKeys.length > 0) {
    return `${FORENSIC_CORE}

Antworte ausschließlich mit einem JSON-Objekt in dieser Form:
{
  "fields": {
    "<feldKey>": {
      "value": "string oder null",
      "confidence": number zwischen 0 und 1,
      "source": { "fileName": "string", "pageNumber": number, "contextSnippet": "string (verbatim aus Chunk-Text)" },
      "requiresManualReview": boolean
    }
  }
}

Jeder der folgenden Feld-Keys (camelCase wie im Digital Product Passport) MUSS als Schlüssel unter "fields" vorkommen — verwende value null und requiresManualReview true, wenn im Kontext nichts Belastbares steht:
${JSON.stringify([...targetPassportFieldKeys])}

Hinweise:
- Numerische Kennwerte (z. B. kWh, kg) als String im Feld "value", z. B. "4,2" oder "4.2".
- "gtin" nur mit Ziffernfolge aus dem Kontext; sonst null.
- "ewcCode" nur wenn ein plausibler Abfallschlüssel im Kontext steht; sonst null.`;
  }

  return `${FORENSIC_CORE}

Antworte ausschließlich mit einem JSON-Objekt in dieser Form:
{
  "gtin": {
    "value": "string oder null",
    "confidence": 0 bis 1,
    "source": {
      "fileName": "string",
      "pageNumber": number,
      "contextSnippet": "string (verbatim aus dem Chunk-Text)"
    },
    "requiresManualReview": boolean
  },
  "ewcCode": {
    "value": "string oder null",
    "confidence": 0 bis 1,
    "source": { "fileName": "string", "pageNumber": number, "contextSnippet": "string" },
    "requiresManualReview": boolean
  }
}

Felder weglassen, wenn es keine belastbare Information gibt (nicht raten).`;
}

export interface ComplianceEnrichmentInput {
  readonly tenantId: string;
  readonly productLabel: string;
  readonly query: string;
  readonly chunks: readonly RetrievedChunk[];
  /** When set, the model returns a provenance bundle under \`fields\` for each passport key. */
  readonly targetPassportFieldKeys?: readonly string[];
}

export interface ComplianceEnrichmentResult {
  readonly auditTrail: AuditTrail;
  readonly rawModelJson: string;
  readonly cryptoValidation: { readonly ok: boolean; readonly errors: readonly string[] };
}

export class ComplianceEnrichmentAgent {
  constructor(private readonly llm: ComplianceLlmPort) {}

  async synthesize(input: ComplianceEnrichmentInput): Promise<ComplianceEnrichmentResult> {
    const systemPrompt = buildSystemPrompt(input.targetPassportFieldKeys);
    const userPrompt = this.buildUserPrompt(input);
    const rawModelJson = await this.llm.completeJson(systemPrompt, userPrompt);
    const parsed = JSON.parse(rawModelJson) as unknown;
    const trail = safeParseAuditTrail(parsed);

    if (!trail.success) {
      throw new Error(`Audit trail schema validation failed: ${trail.error.message}`);
    }

    const cryptoValidation = validateAuditTrailCryptographically(trail.data);
    const provenanceErrors = ComplianceEnrichmentAgent.validateProvenance(trail.data, input.chunks);

    if (provenanceErrors.length > 0) {
      throw new Error(`Provenance validation failed: ${provenanceErrors.join(' ')}`);
    }

    return {
      auditTrail: trail.data,
      rawModelJson,
      cryptoValidation,
    };
  }

  private static validateProvenance(trail: AuditTrail, chunks: readonly RetrievedChunk[]): string[] {
    const errors: string[] = [
      ...ComplianceEnrichmentAgent.validateFieldProvenance('gtin', trail.gtin, chunks),
      ...ComplianceEnrichmentAgent.validateFieldProvenance('ewcCode', trail.ewcCode, chunks),
    ];

    if (trail.fields) {
      for (const [key, value] of Object.entries(trail.fields)) {
        errors.push(
          ...ComplianceEnrichmentAgent.validateFieldProvenance(`fields.${key}`, value, chunks),
        );
      }
    }

    return errors;
  }

  private static validateFieldProvenance(
    field: string,
    value: AuditedValue | undefined,
    chunks: readonly RetrievedChunk[],
  ): string[] {
    if (!value) {
      return [];
    }

    const chunk = chunks.find(
      (c) => c.fileName === value.source.fileName && c.pageNumber === value.source.pageNumber,
    );

    if (!chunk) {
      return [`${field}: source references unknown chunk (${value.source.fileName} p${value.source.pageNumber}).`];
    }

    if (!chunk.text.includes(value.source.contextSnippet)) {
      return [`${field}: contextSnippet is not a verbatim substring of the referenced chunk text.`];
    }

    return [];
  }

  private buildUserPrompt(input: ComplianceEnrichmentInput): string {
    const chunkPayload = input.chunks.map((chunk, index) => ({
      rank: index + 1,
      score: chunk.score,
      keywordScore: chunk.keywordScore,
      vectorScore: chunk.vectorScore,
      metadata: {
        tenantId: input.tenantId,
        fileName: chunk.fileName,
        pageNumber: chunk.pageNumber,
      },
      text: chunk.text,
    }));

    const lines = [
      `tenantId: ${input.tenantId}`,
      `productLabel: ${input.productLabel}`,
      `query: ${input.query}`,
    ];

    if (input.targetPassportFieldKeys?.length) {
      lines.push(`targetPassportFieldKeys: ${input.targetPassportFieldKeys.join(', ')}`);
    }

    lines.push('', 'chunks:', JSON.stringify(chunkPayload, null, 2));

    return lines.join('\n');
  }
}
