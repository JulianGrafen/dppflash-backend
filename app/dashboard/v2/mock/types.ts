export type DraftStatus = 'draft' | 'review' | 'published';

export type DocumentStatus = 'queued' | 'processing' | 'done' | 'error';

export type FieldProvenance = 'ai' | 'confirmed' | 'missing' | 'pending_supplier';

export type PassportFieldProvenance = 'empty' | 'ai' | 'confirmed' | 'missing';

export type PassportFieldSourceKind = 'pdf' | 'word' | 'excel' | 'image' | 'sap_s4' | 'api';

/** Nachvollziehbare KI-Herkunft für einen PassPer-Feldwert (Editor Audit-Trail). */
export type PassportFieldSourceAttribution = {
  kind: PassportFieldSourceKind;
  documentTitle: string;
  documentId: string;
  locationLabel: string;
  contextSnippet: string;
  pageNumber?: number;
  excerptBefore?: string;
  excerptAfter?: string;
};

export type PassportFieldValueState = {
  value: string;
  /** Öffentliche Pass-Ansicht DE (Fallback: `value`). */
  valueDe?: string;
  /** Öffentliche Pass-Ansicht EN. */
  valueEn?: string;
  provenance: PassportFieldProvenance;
  confidence: number;
  mandatory: boolean;
  source?: PassportFieldSourceAttribution;
};

export type FieldBlock =
  | 'identification'
  | 'materials'
  | 'origin'
  | 'recycling'
  | 'technical'
  | 'certificates';

export type DraftDocument = {
  id: string;
  name: string;
  type: string;
  status: DocumentStatus;
};

export type DraftField = {
  path: string;
  label: string;
  block: FieldBlock;
  value: string | null;
  provenance: FieldProvenance;
  confidence: number;
  critical: boolean;
  supplierHint?: string;
  supplierEmail?: string;
  /** ISO timestamp when supplier outreach was sent (mock). */
  supplierSentAt?: string;
};

export type DraftPassport = {
  id: string;
  productName: string;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  creationMethod: 'upload' | 'import' | 'manual' | 'existing';
  visitedSteps: string[];
  documents: DraftDocument[];
  fields: DraftField[];
  passportFields?: Record<string, PassportFieldValueState>;
  publishedPassId?: string;
  publishedUrl?: string;
};

export type CompletenessSummary = {
  completenessPercent: number;
  missingCount: number;
  needsReviewCount: number;
  criticalOk: boolean;
};

export const WIZARD_STEPS = ['upload', 'review-data', 'gaps', 'check', 'publish'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export const BLOCK_LABELS: Record<FieldBlock, string> = {
  identification: 'Identität & Produkt',
  materials: 'Materialien & Komponenten',
  origin: 'Herkunft & Lieferkette',
  recycling: 'Recycling & Kreislauf',
  technical: 'Technische Eigenschaften',
  certificates: 'Zertifikate & Nachweise',
};
