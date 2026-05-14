import type { RagComplianceOrchestrator } from '@/app/application/use-cases/rag/RagComplianceOrchestrator';
import type { ComplianceEnrichmentResult } from '@/app/application/services/rag/ComplianceEnrichmentAgent';
import { mergeRagAuditIntoPassport } from '@/app/domain/rag/mergeRagAuditIntoPassport';
import { stripCryptoInvalidAuditedValues } from '@/app/domain/rag/auditTrailValidation';
import {
  buildProductIdentityQueryPrefix,
  buildProductMatchTerms,
} from '@/app/domain/rag/productBrainMatch';
import {
  getRagTargetFieldKeysForProductType,
  isPassportGtinMissing,
  orderRagTargetKeysPrioritizingGtin,
} from '@/app/domain/rag/ragPassportFieldTargets';
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
    const keys = orderRagTargetKeysPrioritizingGtin(
      getRagTargetFieldKeysForProductType(input.productType),
      input.passport as Record<string, unknown>,
    );
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
    pushHint('GTIN (aktuell im Pass)', p.gtin);

    const queryLines = [
      identityPrefix,
      `Digital Product Passport / ESPR Stammdaten und Kennwerte für "${input.productLabel}".`,
      `Relevante Felder (camelCase), Reihenfolge mit Priorität: ${keys.join(', ')}.`,
    ];
    if (isPassportGtinMissing(p)) {
      queryLines.push(
        'Priorität: Es fehlt noch eine belastbare GTIN/EAN im Pass — extrahiere diese zuerst aus den Chunks, falls dort eine gültige Ziffernfolge eindeutig erkennbar ist (wörtlicher Beleg im contextSnippet). Keine erfundenen GTINs.',
      );
    }
    queryLines.push(
      'Berücksichtige außerdem: Hersteller, Modellbezeichnung, technische Daten, Entsorgungscodes (EWC/EAK/AVV), Sicherheitsdatenblatt, technisches Merkblatt, Abschnitt 13 Entsorgung.',
      ...hints,
    );
    const query = queryLines.join('\n');

    const { enrichment, retrievalMatchConfidence } = await orchestrator.runComplianceExtraction({
      tenantId: input.tenantId,
      productLabel: input.productLabel,
      query,
      targetPassportFieldKeys: keys,
      productMatchTerms: matchTerms,
      sourceFileName: input.sourceFileName,
    });

    const trailForMerge = stripCryptoInvalidAuditedValues(enrichment.auditTrail);
    const { patch, appliedKeys } = mergeRagAuditIntoPassport(
      input.passport,
      trailForMerge,
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
