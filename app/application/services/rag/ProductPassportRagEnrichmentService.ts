import type { RagComplianceOrchestrator } from '@/app/application/use-cases/rag/RagComplianceOrchestrator';
import type { ComplianceEnrichmentResult } from '@/app/application/services/rag/ComplianceEnrichmentAgent';
import { mergeRagAuditIntoPassport } from '@/app/domain/rag/mergeRagAuditIntoPassport';
import {
  buildProductIdentityQueryPrefix,
  buildProductMatchTerms,
} from '@/app/domain/rag/productBrainMatch';
import { getRagTargetFieldKeysForProductType } from '@/app/domain/rag/ragPassportFieldTargets';
import type { ProductPassport } from '@/app/types/dpp-types';

/**
 * Runs one hybrid retrieval + forensic synthesis pass to fill empty passport fields from the RAG index.
 */
export class ProductPassportRagEnrichmentService {
  async enrichFromIndexedChunks(
    orchestrator: RagComplianceOrchestrator,
    input: {
      readonly tenantId: string;
      readonly productType: ProductPassport['type'];
      readonly productLabel: string;
      readonly passport: ProductPassport;
      /** Indexed PDF basename; aligns retrieval with chunks from that upload. */
      readonly sourceFileName?: string;
    },
  ): Promise<{
    readonly passportPatch: Record<string, unknown>;
    readonly appliedKeys: readonly string[];
    readonly enrichment: ComplianceEnrichmentResult;
    readonly retrievalMatchConfidence: number;
  }> {
    const keys = getRagTargetFieldKeysForProductType(input.productType);
    const p = input.passport as Record<string, unknown>;
    const matchTerms = buildProductMatchTerms(p, input.productLabel);
    const identityPrefix = buildProductIdentityQueryPrefix(p, input.productLabel);

    const hints: string[] = [];
    const pushHint = (label: string, v: unknown) => {
      if (typeof v === 'string' && v.trim()) {
        hints.push(`${label}: ${v.trim().slice(0, 280)}`);
      }
    };
    pushHint('Produktname (ESPR)', p.productName);
    pushHint('Abfall / EoL (ESPR)', p.endOfLifeInstructions);
    pushHint('Abfallschlüssel', p.wasteCode);
    pushHint('UPI', p.upi);
    pushHint('GTIN', p.gtin);

    const query = [
      identityPrefix,
      `Digital Product Passport / ESPR Stammdaten und Kennwerte für "${input.productLabel}".`,
      `Relevante Felder (camelCase): ${keys.join(', ')}.`,
      'Berücksichtige GTIN/EAN, Hersteller, Modellbezeichnung, technische Daten, Entsorgungscodes (EWC/EAK/AVV), Sicherheitsdatenblatt, technisches Merkblatt, Abschnitt 13 Entsorgung.',
      ...hints,
    ].join('\n');

    const { enrichment, retrievalMatchConfidence } = await orchestrator.runComplianceExtraction({
      tenantId: input.tenantId,
      productLabel: input.productLabel,
      query,
      targetPassportFieldKeys: keys,
      productMatchTerms: matchTerms,
      sourceFileName: input.sourceFileName,
    });

    const { patch, appliedKeys } = mergeRagAuditIntoPassport(
      input.passport,
      enrichment.auditTrail,
      keys,
    );

    return {
      passportPatch: patch,
      appliedKeys,
      enrichment,
      retrievalMatchConfidence,
    };
  }
}
