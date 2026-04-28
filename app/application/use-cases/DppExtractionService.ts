import {
  DppValidationError,
  type DppProductPassport,
  type DppValidationIssue,
} from '@/app/domain/dpp/dppSchema';
import type { DppValidationService } from '@/app/domain/dpp/validation/DppValidationService';
import type { ValidationResult } from '@/app/domain/dpp/validation/DppValidationTypes';
import type { PdfAnalysisPort } from '@/app/application/ports/PdfAnalysisPort';
import type { SafeLoggerPort } from '@/app/application/ports/SafeLoggerPort';
import type { SemanticDppExtractionPort } from '@/app/application/ports/SemanticDppExtractionPort';

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
}

interface DppExtractionServiceDependencies {
  readonly pdfAnalyzer: PdfAnalysisPort;
  readonly semanticExtractor: SemanticDppExtractionPort;
  readonly dppValidationService: DppValidationService;
  readonly logger: SafeLoggerPort;
}

export class DppExtractionService {
  constructor(private readonly dependencies: DppExtractionServiceDependencies) {}

  async extractFromPdf(request: DppExtractionRequest): Promise<DppExtractionResponse> {
    const startedAt = Date.now();

    this.dependencies.logger.info('dpp_extraction_started', {
      fileSizeBytes: request.pdf.byteLength,
      hasProductTypeHint: Boolean(request.productTypeHint),
    });

    const analysis = await this.dependencies.pdfAnalyzer.analyze({
      pdf: request.pdf,
      fileName: request.fileName,
    });

    this.dependencies.logger.info('pdf_analysis_completed', {
      textLength: analysis.text.length,
      pageCount: analysis.pageCount,
    });

    const semanticResult = await this.dependencies.semanticExtractor.extract({
      documentText: analysis.text,
      productTypeHint: request.productTypeHint,
    });

    const validation = this.dependencies.dppValidationService.validate(semanticResult.dpp);

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
      dpp: semanticResult.dpp,
      confidence: semanticResult.confidence,
      warnings: [...semanticResult.warnings, ...validation.warnings],
      validationIssues: [],
      validationResult: validation,
      pageCount: analysis.pageCount,
    };
  }
}
