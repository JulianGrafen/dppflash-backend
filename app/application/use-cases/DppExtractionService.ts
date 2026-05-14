import {
  DppValidationError,
  type DppProductPassport,
  type DppValidationIssue,
} from '@/app/domain/dpp/dppSchema';
import { DppEnrichmentAgent } from '@/app/application/services/DppEnrichmentAgent';
import { WasteCodeService } from '@/app/application/services/WasteCodeService';
import type { DppValidationService } from '@/app/domain/dpp/validation/DppValidationService';
import type { ValidationResult } from '@/app/domain/dpp/validation/DppValidationTypes';
import type { SafeLoggerPort } from '@/app/application/ports/SafeLoggerPort';
import type { SemanticDppExtractionPort } from '@/app/application/ports/SemanticDppExtractionPort';
import type { RegulatoryStructuredDppExtractionPort } from '@/app/application/ports/RegulatoryStructuredDppExtractionPort';
import type { DppExtractionPayload } from '@/app/domain/dpp/dppExtractionZodSchema';

export interface DppExtractionRequest {
  readonly pdf: Buffer;
  readonly fileName: string;
  readonly productTypeHint?: string;
}

export interface DppExtractionResponse {
  readonly dpp: DppProductPassport;
  readonly confidence: number;
  readonly warnings: readonly string[];
  readonly validationIssues: readonly DppValidationIssue[];
  readonly validationResult: ValidationResult;
  readonly pageCount: number;
  /** Audited six-pillar + composition graph (when regulatory extractor is configured). */
  readonly regulatoryExtraction?: DppExtractionPayload;
}

interface DppExtractionServiceDependencies {
  readonly semanticExtractor: SemanticDppExtractionPort;
  readonly dppValidationService: DppValidationService;
  readonly logger: SafeLoggerPort;
  /** Optional OpenAI JSON path for six-pillar audited extraction + Sankey graph. */
  readonly regulatoryStructuredExtractor?: RegulatoryStructuredDppExtractionPort;
}

const PENDING_EXTERNAL_MATCH = 'PENDING_EXTERNAL_MATCH';
const REVIEW_REQUIRED = 'REVIEW_REQUIRED';
const COMPLIANT = 'COMPLIANT';
const WASTE_CODE_PATTERN = /\b\d{2}\s?\d{2}\s?\d{2}\*?\b/;

/**
 * Text sources where EWC/EAK codes often appear when the model missed `wasteCode` / `endOfLifeInstructions`.
 */
function collectWasteCodeSearchTexts(dpp: DppProductPassport): readonly string[] {
  const texts: string[] = [];
  const push = (value: string | undefined) => {
    const t = value?.trim();
    if (t) {
      texts.push(t);
    }
  };

  push(dpp.wasteCode);
  push(dpp.endOfLifeInstructions);

  const care = dpp.careRepairDurability;
  if (care) {
    push([care.careInstructions, care.repairInstructions, care.durabilityGuidance].filter(Boolean).join('\n'));
  }

  push(dpp.environmentalImpact?.impactNotes);

  for (const row of dpp.supplierAndProcessInformation ?? []) {
    push(row.processDescription);
    push(row.processName);
  }

  for (const ch of dpp.chemicalComposition ?? []) {
    push([ch.substance, ch.function, ch.casNumber].filter(Boolean).join(' '));
  }

  for (const m of dpp.materialComposition ?? []) {
    push(m.material);
  }

  for (const s of dpp.substancesOfConcern ?? []) {
    push([s.name, s.hazardClass, s.casNumber].filter(Boolean).join(' '));
  }

  return texts;
}

function extractWasteCodeCandidate(dpp: DppProductPassport): string | undefined {
  for (const candidate of collectWasteCodeSearchTexts(dpp)) {
    const match = candidate.match(WASTE_CODE_PATTERN);
    if (match?.[0]) {
      return match[0];
    }
  }

  return undefined;
}

function enrichWasteCode(dpp: DppProductPassport): {
  readonly dpp: DppProductPassport;
  readonly warnings: readonly string[];
} {
  const rawWasteCode = extractWasteCodeCandidate(dpp);

  if (!rawWasteCode) {
    return { dpp, warnings: [] };
  }

  const resolution = WasteCodeService.resolve(rawWasteCode);
  const existingInstructions = dpp.endOfLifeInstructions?.trim();
  const mergedInstructions = existingInstructions
    ? existingInstructions.includes(resolution.instruction)
      ? existingInstructions
      : `${existingInstructions} ${resolution.instruction}`
    : resolution.instruction;

  return {
    dpp: {
      ...dpp,
      wasteCode: resolution.normalizedCode,
      endOfLifeInstructions: mergedInstructions,
    },
    warnings: [
      ...(dpp.wasteCode ? [] : [`wasteCode: Extracted from disposal text (${resolution.normalizedCode}).`]),
      ...(resolution.found
        ? []
        : [`wasteCode: ${resolution.instruction} (${resolution.normalizedCode || rawWasteCode})`]),
    ],
  };
}

function needsIdentifierEnrichment(dpp: DppProductPassport): boolean {
  return !dpp.gtin || dpp.gtin === PENDING_EXTERNAL_MATCH;
}

function withAppliedEnrichment(
  dpp: DppProductPassport,
  enrichment: {
    readonly gtin?: string;
    readonly origin?: string;
    readonly confidence: number;
    readonly sourceUrls: readonly string[];
    readonly requiresManualReview: boolean;
    readonly reviewReason: string | null;
  },
): DppProductPassport {
  const enrichedFields: string[] = [];
  const nextGtin = enrichment.gtin ?? dpp.gtin;
  const nextCountryOfOrigin = enrichment.origin ?? dpp.countryOfOrigin;

  if (enrichment.gtin && enrichment.gtin !== dpp.gtin) {
    enrichedFields.push('gtin');
  }

  if (enrichment.origin && enrichment.origin !== dpp.countryOfOrigin) {
    enrichedFields.push('countryOfOrigin');
  }

  const reviewRequired = enrichedFields.length > 0 || enrichment.requiresManualReview;

  return {
    ...dpp,
    gtin: nextGtin,
    countryOfOrigin: nextCountryOfOrigin,
    complianceStatus: reviewRequired ? REVIEW_REQUIRED : (dpp.complianceStatus ?? COMPLIANT),
    enrichmentReview: reviewRequired
      ? {
          required: true,
          status: 'PENDING',
          enrichedFields,
          sourceUrls: enrichment.sourceUrls,
          confidence: enrichment.confidence,
          requiresManualReview: enrichment.requiresManualReview,
          reviewReason: enrichment.reviewReason,
        }
      : dpp.enrichmentReview,
  };
}

export class DppExtractionService {
  constructor(private readonly dependencies: DppExtractionServiceDependencies) {}

  private async enrichIdentifiersIfNeeded(dpp: DppProductPassport): Promise<{
    readonly dpp: DppProductPassport;
    readonly warnings: readonly string[];
  }> {
    if (!needsIdentifierEnrichment(dpp)) {
      return { dpp, warnings: [] };
    }

    try {
      const enrichment = await DppEnrichmentAgent.enrich({
        productName: dpp.productName,
        manufacturer: dpp.manufacturer?.name,
      });

      const enrichedDpp = withAppliedEnrichment(dpp, enrichment);
      const enrichmentWarnings = enrichment.gtin || enrichment.origin
        ? []
        : ['identifierEnrichment: No matching GTIN/origin found from web sources.'];

      return {
        dpp: enrichedDpp,
        warnings: [
          ...enrichmentWarnings,
          ...enrichment.sourceUrls.map((url) => `identifierEnrichmentSource: ${url}`),
        ],
      };
    } catch (error) {
      this.dependencies.logger.warn('dpp_identifier_enrichment_failed', {
        message: error instanceof Error ? error.message : 'unknown',
      });

      return {
        dpp,
        warnings: ['identifierEnrichment: External enrichment skipped due to provider error.'],
      };
    }
  }

  async extractFromPdf(request: DppExtractionRequest): Promise<DppExtractionResponse> {
    const startedAt = Date.now();

    this.dependencies.logger.info('dpp_extraction_started', {
      fileSizeBytes: request.pdf.byteLength,
      hasProductTypeHint: Boolean(request.productTypeHint),
    });

    const semanticResult = await this.dependencies.semanticExtractor.extract({
      pdf: request.pdf,
      fileName: request.fileName,
      productTypeHint: request.productTypeHint,
    });

    let regulatoryExtraction: DppExtractionPayload | undefined;
    const reg = this.dependencies.regulatoryStructuredExtractor;
    if (reg) {
      try {
        regulatoryExtraction = await reg.extract({
          pdf: request.pdf,
          sourcePdf: request.fileName,
        });
      } catch (err) {
        this.dependencies.logger.warn('regulatory_structured_extraction_failed', {
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const identifierEnrichment = await this.enrichIdentifiersIfNeeded(semanticResult.dpp);
    const wasteCodeEnrichment = enrichWasteCode(identifierEnrichment.dpp);

    const validation = this.dependencies.dppValidationService.validate(wasteCodeEnrichment.dpp);

    if (!validation.isValid) {
      this.dependencies.logger.warn('dpp_validation_failed', {
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length,
        validationScore: validation.score,
        durationMs: Date.now() - startedAt,
      });
      throw new DppValidationError(
        validation.findings
          .filter((finding) => finding.severity === 'error')
          .map((finding) => ({
            field: finding.field ?? finding.code,
            message: finding.message,
          })),
      );
    }

    this.dependencies.logger.info('dpp_extraction_completed', {
      confidence: semanticResult.confidence,
      warningCount: semanticResult.warnings.length + validation.warnings.length,
      validationScore: validation.score,
      durationMs: Date.now() - startedAt,
    });

    return {
      dpp: wasteCodeEnrichment.dpp,
      confidence: semanticResult.confidence,
      warnings: [
        ...semanticResult.warnings,
        ...identifierEnrichment.warnings,
        ...wasteCodeEnrichment.warnings,
        ...validation.warnings,
      ],
      validationIssues: [],
      validationResult: validation,
      pageCount: semanticResult.pageCount,
      regulatoryExtraction,
    };
  }
}
