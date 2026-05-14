import type { ComplianceLlmPort } from '@/app/application/ports/rag/ComplianceLlmPort';
import type { RetrievedChunk } from '@/app/application/services/rag/HybridRetrievalService';
import {
  GAP_TARGETED_CONTEXT_MARKER,
  buildGapLlmResponseSchema,
  type GapLlmFieldRow,
} from '@/app/domain/rag/gapTargetedExtractionSchema';
import { safeParseAuditTrail, type AuditTrail, type AuditedValue } from '@/app/domain/rag/auditTrailSchema';
import { validateAuditTrailCryptographically } from '@/app/domain/rag/auditTrailValidation';

const FORENSIC_CORE = `Du bist ein forensischer Daten-Auditor. Beantworte die Frage AUSSCHLIESSLICH basierend auf dem bereitgestellten Kontext (Chunks). Wenn die Antwort nicht im Kontext steht, gib null zurück. Erfinde niemals Daten. Zitiere für jeden Wert exakt den 'contextSnippet', die 'pageNumber' und den 'fileName' aus den Metadaten der Chunks.

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

const GAP_LLM_TOP_CHUNKS = 5;

function buildGapTargetedComplianceAuditorSystemPrompt(
  anchorProductName: string,
  missingFieldKeys: readonly string[],
): string {
  const keysList = missingFieldKeys.join(', ');
  const keysJson = JSON.stringify([...missingFieldKeys]);
  return `Du bist ein Compliance-Auditor. Finde für das Produkt "${anchorProductName}" AUSSCHLIESSLICH die fehlenden Felder: ${keysList}. Nutze NUR das folgende Wissen aus der Datenbank (der Textblock unter "### KONTEXT_AUS_DATENBANK"). Wenn etwas nicht im Text steht, setze "value" auf null. Zitiere für jeden Wert den Dateinamen in "sourcePdf" (wie in der Quelle genannt) und einen kurzen wörtlichen "contextSnippet" aus dem Text.

Ausgabe: genau EIN JSON-Objekt (ohne Markdown). Top-Level-Keys sind exakt diese camelCase-Feldnamen: ${keysJson}
Jeder Eintrag MUSS dieses Objekt sein:
{ "value": string | null, "sourcePdf": string, "contextSnippet": string }
- Bei fehlendem Beleg: value=null, sourcePdf und contextSnippet leere Strings "" oder kurz "—".
- Keine zusätzlichen Top-Level-Keys. Numerische Kennwerte als String in "value".

Hinweise:
- "gtin": nur Ziffernfolge aus dem Kontext; sonst null.
- "ewcCode" / "wasteCode": nur bei plausibler EWC/EAK-Angabe im Text; sonst null.`;
}

function formatTopChunksForGapKnowledgeContext(chunks: readonly RetrievedChunk[]): string {
  return chunks
    .map(
      (c) =>
        `--- Quelle: ${c.fileName} (Seite ${c.pageNumber}) ---\n${c.text}`,
    )
    .join('\n\n');
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
    if (input.gapTargetedExtraction && input.gapTargetedExtraction.missingFieldKeys.length > 0) {
      return this.gapTargetedExtraction(input);
    }

    const systemPrompt = buildSystemPrompt(input.targetPassportFieldKeys);
    const userPrompt = this.buildUserPrompt(input);

    let rawModelJson: string;
    try {
      rawModelJson = await this.llm.completeJson(systemPrompt, userPrompt);
    } catch (error) {
      console.error('[RAG LLM ERROR]', error);
      return ComplianceEnrichmentAgent.emptyGapEnrichmentResult('{}');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawModelJson) as unknown;
    } catch (error) {
      console.error('[RAG LLM ERROR]', error);
      return ComplianceEnrichmentAgent.emptyGapEnrichmentResult(rawModelJson);
    }

    const trail = safeParseAuditTrail(parsed);
    if (!trail.success) {
      console.error('[RAG LLM ERROR]', trail.error);
      return ComplianceEnrichmentAgent.emptyGapEnrichmentResult(rawModelJson);
    }

    const cryptoValidation = validateAuditTrailCryptographically(trail.data);
    const provenanceErrors = ComplianceEnrichmentAgent.validateProvenance(trail.data, input.chunks);

    if (provenanceErrors.length > 0) {
      console.error('[RAG LLM ERROR]', provenanceErrors.join(' '));
      return ComplianceEnrichmentAgent.emptyGapEnrichmentResult(rawModelJson);
    }

    return {
      auditTrail: trail.data,
      rawModelJson,
      cryptoValidation,
    };
  }

  /**
   * Stufe 4: sekundäre Extraktion (`gapTargetedExtraction`) — nur Top-5-Chunks, strikter Auditor-Prompt,
   * Zod-Validierung, try/catch inkl. `console.error('[RAG LLM ERROR]', …)` bei jedem Abbruch.
   */
  private async gapTargetedExtraction(input: ComplianceEnrichmentInput): Promise<ComplianceEnrichmentResult> {
    const gap = input.gapTargetedExtraction!;
    const missingKeys = [...gap.missingFieldKeys];
    const topChunks = input.chunks.slice(0, GAP_LLM_TOP_CHUNKS);

    const systemPrompt = buildGapTargetedComplianceAuditorSystemPrompt(
      gap.anchorProductName,
      missingKeys,
    );
    const userPrompt = ComplianceEnrichmentAgent.buildGapTargetedUserPrompt(input, topChunks);

    let rawModelJson = '{}';

    try {
      rawModelJson = await this.llm.completeJson(systemPrompt, userPrompt);
    } catch (error) {
      console.error('[RAG LLM ERROR]', error);
      return ComplianceEnrichmentAgent.emptyGapEnrichmentResult(rawModelJson);
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawModelJson) as unknown;
    } catch (error) {
      console.error('[RAG LLM ERROR]', error);
      return ComplianceEnrichmentAgent.emptyGapEnrichmentResult(rawModelJson);
    }

    const rawObj =
      typeof parsedJson === 'object' && parsedJson !== null
        ? (parsedJson as Record<string, unknown>)
        : {};

    const filled: Record<string, unknown> = {};
    for (const k of missingKeys) {
      filled[k] = rawObj[k] ?? { value: null, sourcePdf: '', contextSnippet: '' };
    }

    const schema = buildGapLlmResponseSchema(missingKeys);
    const zodParsed = schema.safeParse(filled);
    if (!zodParsed.success) {
      console.error('[RAG LLM ERROR]', zodParsed.error);
      return ComplianceEnrichmentAgent.emptyGapEnrichmentResult(rawModelJson);
    }

    const fieldsRecord = ComplianceEnrichmentAgent.mapGapLlmRowsToAuditedFields(
      zodParsed.data as Record<string, GapLlmFieldRow>,
      topChunks,
      missingKeys,
    );

    const trail = safeParseAuditTrail({ fields: fieldsRecord });
    if (!trail.success) {
      console.error('[RAG LLM ERROR]', trail.error);
      return ComplianceEnrichmentAgent.emptyGapEnrichmentResult(rawModelJson);
    }

    const cryptoValidation = validateAuditTrailCryptographically(trail.data);
    const provenanceErrors = ComplianceEnrichmentAgent.validateProvenance(trail.data, topChunks);

    if (provenanceErrors.length > 0) {
      console.error('[RAG LLM ERROR]', provenanceErrors.join(' '));
      return ComplianceEnrichmentAgent.emptyGapEnrichmentResult(rawModelJson);
    }

    return {
      auditTrail: trail.data,
      rawModelJson,
      cryptoValidation,
    };
  }

  private static emptyGapEnrichmentResult(rawModelJson: string): ComplianceEnrichmentResult {
    const emptyTrail = safeParseAuditTrail({ fields: {} });
    if (!emptyTrail.success) {
      throw new Error(emptyTrail.error.message);
    }
    const data = emptyTrail.data;
    return {
      auditTrail: data,
      rawModelJson,
      cryptoValidation: validateAuditTrailCryptographically(data),
    };
  }

  private static buildGapTargetedUserPrompt(
    input: ComplianceEnrichmentInput,
    topChunks: readonly RetrievedChunk[],
  ): string {
    const gap = input.gapTargetedExtraction!;
    const lines = [
      `tenantId: ${input.tenantId}`,
      `productLabel: ${input.productLabel}`,
      `query: ${input.query}`,
      `gapTargetedExtraction.anchorProductName: ${gap.anchorProductName}`,
      `gapTargetedExtraction.missingFieldKeys: ${gap.missingFieldKeys.join(', ')}`,
    ];

    const contextBody = formatTopChunksForGapKnowledgeContext(topChunks);
    return `${lines.join('\n')}${GAP_TARGETED_CONTEXT_MARKER}${contextBody}`;
  }

  private static mapGapLlmRowsToAuditedFields(
    data: Record<string, GapLlmFieldRow>,
    topChunks: readonly RetrievedChunk[],
    missingKeys: readonly string[],
  ): Record<string, AuditedValue> {
    const out: Record<string, AuditedValue> = {};
    for (const key of missingKeys) {
      const row = data[key];
      if (!row) {
        continue;
      }
      const normalizedValue = row.value;
      const chunk = ComplianceEnrichmentAgent.findChunkForGapCitation(
        topChunks,
        row.sourcePdf,
        row.contextSnippet,
      );
      const snippetTrim = row.contextSnippet.trim();
      const snippetOk =
        normalizedValue === null
          ? true
          : Boolean(chunk && ComplianceEnrichmentAgent.chunkContainsSnippet(chunk.text, row.contextSnippet));

      const fileName =
        chunk?.fileName ??
        (row.sourcePdf.trim().length > 0 ? row.sourcePdf.trim() : topChunks[0]?.fileName) ??
        'unknown';
      const pageNumber = chunk?.pageNumber ?? topChunks[0]?.pageNumber ?? 1;

      out[key] = {
        value: normalizedValue,
        confidence: normalizedValue === null ? 0 : snippetOk ? 0.88 : 0.35,
        source: {
          fileName,
          pageNumber,
          contextSnippet: snippetTrim.length > 0 ? snippetTrim : '(kein Beleg)',
        },
        requiresManualReview:
          normalizedValue !== null && (!snippetOk || !row.sourcePdf.trim() || snippetTrim.length < 2),
      };
    }
    return out;
  }

  private static findChunkForGapCitation(
    chunks: readonly RetrievedChunk[],
    sourcePdf: string,
    contextSnippet: string,
  ): RetrievedChunk | undefined {
    const base = ComplianceEnrichmentAgent.fileBaseName(sourcePdf.trim());
    const byName = chunks.filter(
      (c) =>
        (base.length > 0 && ComplianceEnrichmentAgent.fileBaseName(c.fileName) === base) ||
        c.fileName === sourcePdf.trim() ||
        (sourcePdf.trim().length > 0 && c.fileName.endsWith(sourcePdf.trim())),
    );
    const pool = byName.length > 0 ? byName : [...chunks];
    const bySnippet = pool.find((c) => ComplianceEnrichmentAgent.chunkContainsSnippet(c.text, contextSnippet));
    if (bySnippet) {
      return bySnippet;
    }
    if (base.length > 0) {
      return pool.find((c) => ComplianceEnrichmentAgent.fileBaseName(c.fileName) === base);
    }
    return pool[0];
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
    if (!value || value.value === null) {
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

    lines.push('', 'chunks:', JSON.stringify(chunkPayload, null, 2));

    return lines.join('\n');
  }
}
