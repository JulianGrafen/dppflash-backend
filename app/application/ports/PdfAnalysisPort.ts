export interface PdfAnalysisInput {
  readonly pdf: Buffer;
  readonly fileName: string;
}

export interface PdfAnalysisResult {
  readonly text: string;
  readonly pageCount: number;
}

export interface PdfAnalysisPort {
  analyze(input: PdfAnalysisInput): Promise<PdfAnalysisResult>;
}
