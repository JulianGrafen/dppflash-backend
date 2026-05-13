import type { RagComplianceOrchestrator } from '@/app/application/use-cases/rag/RagComplianceOrchestrator';
import type { ComplianceEnrichmentResult } from '@/app/application/services/rag/ComplianceEnrichmentAgent';
import { mergeRagAuditIntoPassport } from '@/app/domain/rag/mergeRagAuditIntoPassport';
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
    },
  ): Promise<{
    readonly passportPatch: Record<string, unknown>;
    readonly appliedKeys: readonly string[];
    readonly enrichment: ComplianceEnrichmentResult;
  }> {
    const keys = getRagTargetFieldKeysForProductType(input.productType);
    const query = [
      `Digital Product Passport / ESPR Stammdaten und Kennwerte für "${input.productLabel}".`,
      `Relevante Felder (camelCase): ${keys.join(', ')}.`,
      'Berücksichtige GTIN/EAN, Hersteller, Modellbezeichnung, technische Daten, Entsorgungscodes (EWC/EAK), Sicherheitshinweise.',
    ].join(' ');

    const enrichment = await orchestrator.runComplianceExtraction({
      tenantId: input.tenantId,
      productLabel: input.productLabel,
      query,
      targetPassportFieldKeys: keys,
    });

    const { patch, appliedKeys } = mergeRagAuditIntoPassport(
      input.passport,
      enrichment.auditTrail,
      keys,
    );

    return { passportPatch: patch, appliedKeys, enrichment };
  }
}
