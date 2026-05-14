import type { ComplianceLlmPort } from '@/app/application/ports/rag/ComplianceLlmPort';
import type { RetrievedChunk } from '@/app/application/services/rag/HybridRetrievalService';
import { safeParseAuditTrail, type AuditTrail, type AuditedValue } from '@/app/domain/rag/auditTrailSchema';
import { validateAuditTrailCryptographically } from '@/app/domain/rag/auditTrailValidation';

const FORENSIC_CORE = `Du bist ein forensischer Daten-Auditor. Beantworte die Frage AUSSCHLIESSLICH basierend auf dem bereitgestellten Kontext (Chunks). Wenn die Antwort nicht im Kontext steht, gib null zurück. Erfinde niemals Daten. Zitiere für jeden Wert exakt den 'contextSnippet', die 'pageNumber' und den 'fileName' aus den Metadaten des Chunks.

Die Chunks können aus mehreren PDF-Dateien desselben Mandanten stammen — ein Beleg aus einer zweiten Datei ist gültig, wenn der Textbeleg dort eindeutig steht.

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
${targetPassportFieldKeys[0] === 'gtin' ? '\nPriorität: Das erste Zielfeld ist "gtin" — wenn im Kontext eine gültige GTIN/EAN erkennbar ist, soll diese mit Chunk-Beleg ausgefüllt werden (keine Halluzination).\n' : ''}
Hinweise:
- Numerische Kennwerte (z. B. kWh, kg) als String im Feld "value", z. B. "4,2" oder "4.2".
- "gtin" nur mit Ziffernfolge aus dem Kontext; sonst null.
- "ewcCode" und "wasteCode" (gleiche Bedeutung: EWC/EAK) nur wenn ein plausibler Abfallschlüssel im Kontext steht; sonst null. Setze höchstens eines mit belastbarem Beleg, nicht zwei widersprüchliche Werte.`;
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

function buildGapTargetedSystemPrompt(
  missingFieldKeys: readonly string[],
  anchorProductName: string,
): string {
  const keysJson = JSON.stringify([...missingFieldKeys]);
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

Du bist ein Daten-Auditor. Das Produkt heißt "${anchorProductName}" (Anker aus der Primärextraktion).
Finde NUR die folgenden noch fehlenden Felder (camelCase wie im Digital Product Passport): ${keysJson}
Nutze AUSSCHLIESSLICH den bereitgestellten Text-Kontext aus den Chunks. Gib zu jedem gefundenen Wert die Quell-Datei (fileName) und einen wörtlichen Beleg (contextSnippet) an.
Wenn ein Feld nicht belastbar belegbar ist, setze value auf null und requiresManualReview auf true.

Jeder der folgenden Feld-Keys MUSS als Schlüssel unter "fields" vorkommen:
${keysJson}

Hinweise:
- Numerische Kennwerte (z. B. kWh, kg) als String im Feld "value", z. B. "4,2" oder "4.2".
- "gtin" nur mit Ziffernfolge aus dem Kontext; sonst null.
- "ewcCode" und "wasteCode" (gleiche Bedeutung: EWC/EAK) nur wenn ein plausibler Abfallschlüssel im Kontext steht; sonst null.`;
}

export interface ComplianceEnrichmentInput {
  readonly tenantId: string;
  readonly productLabel: string;
  readonly query: string;
  readonly chunks: readonly RetrievedChunk[];
  /** When set, the model returns a provenance bundle under \`fields\` for each passport key. */
  readonly targetPassportFieldKeys?: readonly string[];
  /** Stufe 4: sekundäres LLM nur für Lücken (Anker + fehlende Keys). */
  readonly gapTargetedExtraction?: {
    readonly anchorProductName: string;
    readonly missingFieldKeys: readonly string[];
  };
}

export interface ComplianceEnrichmentResult {
  readonly auditTrail: AuditTrail;
  readonly rawModelJson: string;
  readonly cryptoValidation: { readonly ok: boolean; readonly errors: readonly string[] };
}

export class ComplianceEnrichmentAgent {
  constructor(private readonly llm: ComplianceLlmPort) {}

  async synthesize(input: ComplianceEnrichmentInput): Promise<ComplianceEnrichmentResult> {
    const systemPrompt =
      input.gapTargetedExtraction && input.gapTargetedExtraction.missingFieldKeys.length > 0
        ? buildGapTargetedSystemPrompt(
            input.gapTargetedExtraction.missingFieldKeys,
            input.gapTargetedExtraction.anchorProductName,
          )
        : buildSystemPrompt(input.targetPassportFieldKeys);
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

  private static fileBaseName(filePath: string): string {
    const parts = filePath.replace(/\\/g, '/').split('/');
    const last = parts[parts.length - 1];
    return (last ?? filePath).trim();
  }

  /**
   * Resolves the chunk that supports an audited value: exact file+page first, then same basename
   * with matching snippet on any page (models often mis-report page numbers).
   */
  private static findProvenanceChunk(
    chunks: readonly RetrievedChunk[],
    value: AuditedValue,
  ): RetrievedChunk | undefined {
    const base = ComplianceEnrichmentAgent.fileBaseName(value.source.fileName);
    const snippet = value.source.contextSnippet;
    const sameBase = chunks.filter(
      (c) => ComplianceEnrichmentAgent.fileBaseName(c.fileName) === base,
    );

    const exactPage = sameBase.find((c) => c.pageNumber === value.source.pageNumber);
    if (exactPage && ComplianceEnrichmentAgent.chunkContainsSnippet(exactPage.text, snippet)) {
      return exactPage;
    }

    return sameBase.find((c) => ComplianceEnrichmentAgent.chunkContainsSnippet(c.text, snippet));
  }

  private static validateFieldProvenance(
    field: string,
    value: AuditedValue | undefined,
    chunks: readonly RetrievedChunk[],
  ): string[] {
    if (!value) {
      return [];
    }

    const chunk = ComplianceEnrichmentAgent.findProvenanceChunk(chunks, value);

    if (!chunk) {
      return [`${field}: source references unknown chunk (${value.source.fileName} p${value.source.pageNumber}).`];
    }

    return [];
  }

  private static chunkContainsSnippet(chunkText: string, snippet: string): boolean {
    if (chunkText.includes(snippet)) {
      return true;
    }
    const collapsedChunk = chunkText.replace(/\s+/g, ' ').trim();
    const collapsedSnippet = snippet.replace(/\s+/g, ' ').trim();
    if (collapsedSnippet.length >= 3 && collapsedChunk.includes(collapsedSnippet)) {
      return true;
    }
    const strip = (s: string) => s.replace(/\s/g, '');
    const a = strip(chunkText);
    const b = strip(snippet);
    return b.length >= 6 && a.includes(b);
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

    if (input.gapTargetedExtraction) {
      lines.push(
        `gapTargetedExtraction.anchorProductName: ${input.gapTargetedExtraction.anchorProductName}`,
        `gapTargetedExtraction.missingFieldKeys: ${input.gapTargetedExtraction.missingFieldKeys.join(', ')}`,
      );
    }

    lines.push('', 'chunks:', JSON.stringify(chunkPayload, null, 2));

    return lines.join('\n');
  }
}
