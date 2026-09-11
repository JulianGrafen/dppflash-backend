import {
  BLOCK_LABELS,
  FIELD_LABELS,
  type AuditFieldPayload,
  type PipelineExtractedData,
} from '@/app/domain/etl/pipelineDisplay';

export type InboundGapRecord = {
  field_path: string;
  reason: string;
  severity?: string;
};

export type InboundPlausibilityFinding = {
  rule_id: string;
  field_path: string;
  message: string;
  severity?: string;
};

export type InboundValidationReportBundle = {
  validation?: {
    missing_field_paths?: string[];
    readiness_score_percent?: number;
    mass_balance_ok?: boolean;
    issues?: string[];
  };
  plausibility?: {
    passed?: boolean;
    findings?: InboundPlausibilityFinding[];
    mass_balance_total_percent?: number | null;
    gtin_checked?: boolean;
    gtin_valid?: boolean | null;
  };
  audit?: {
    is_fully_compliant?: boolean;
    co2_mapping_applied?: boolean;
    co2_notes?: string | null;
    issues?: string[];
  };
  analysis_snapshot?: PipelineExtractedData & { product_category?: string };
  filled_field_paths?: string[];
  total_field_paths?: number;
};

export type DraftAuditFieldRow = {
  path: string;
  label: string;
  block: string;
  status: 'filled' | 'erp' | 'pdf' | 'inference' | 'missing';
  value: string | null;
  source_system: string | null;
  source_detail: string | null;
  timestamp: string | null;
  gap_reason: string | null;
};

export const SOURCE_SYSTEM_LABELS: Record<string, string> = {
  ERP_MASTER_DATA: 'ERP / Excel',
  DOCUMENT_SDS: 'PDF / SDS',
  SAP_VENDOR_MASTER: 'SAP Stammdaten',
  SAP_PO_HISTORY: 'SAP Bestellhistorie',
  SAP_SRM: 'SAP SRM',
  HUMAN_INPUT: 'Manuelle Eingabe',
  SYSTEM_INFERENCE: 'System-Inferenz',
};

const AUDIT_BLOCKS = [
  'identification',
  'economic_operator',
  'product_details',
  'sustainability',
  'system_requirements',
] as const;

function isAuditField(value: unknown): value is AuditFieldPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    'source_system' in value
  );
}

function unwrapAuditValue(value: unknown): unknown {
  if (isAuditField(value)) {
    return value.value;
  }
  return value;
}

function formatFieldValue(value: unknown): string | null {
  const unwrapped = unwrapAuditValue(value);
  if (unwrapped === null || unwrapped === undefined) {
    return null;
  }
  if (typeof unwrapped === 'boolean') {
    return unwrapped ? 'Ja' : 'Nein';
  }
  if (typeof unwrapped === 'string') {
    return unwrapped.trim() || null;
  }
  if (typeof unwrapped === 'number') {
    return String(unwrapped);
  }
  return null;
}

function auditMeta(value: unknown): Pick<DraftAuditFieldRow, 'source_system' | 'source_detail' | 'timestamp'> {
  if (!isAuditField(value)) {
    return { source_system: null, source_detail: null, timestamp: null };
  }
  return {
    source_system: value.source_system ?? null,
    source_detail: value.source_detail ?? null,
    timestamp: value.timestamp ?? null,
  };
}

function resolveNestedValue(
  analysis: PipelineExtractedData | null | undefined,
  dotPath: string,
): unknown {
  if (!analysis) {
    return null;
  }
  const [block, field] = dotPath.split('.');
  const blockData = analysis[block as keyof PipelineExtractedData];
  if (!blockData || typeof blockData !== 'object') {
    return null;
  }
  return (blockData as Record<string, unknown>)[field];
}

function classifySourceStatus(sourceSystem: string | null, hasValue: boolean): DraftAuditFieldRow['status'] {
  if (!hasValue) {
    return 'missing';
  }
  if (!sourceSystem) {
    return 'filled';
  }
  if (sourceSystem === 'ERP_MASTER_DATA') {
    return 'erp';
  }
  if (sourceSystem === 'DOCUMENT_SDS') {
    return 'pdf';
  }
  if (sourceSystem === 'SYSTEM_INFERENCE') {
    return 'inference';
  }
  return 'filled';
}

function collectKnownPaths(
  analysis: PipelineExtractedData | null | undefined,
  report: InboundValidationReportBundle | null | undefined,
  gaps: InboundGapRecord[],
): string[] {
  const paths = new Set<string>(Object.keys(FIELD_LABELS));

  if (report?.filled_field_paths) {
    for (const path of report.filled_field_paths) {
      paths.add(path);
    }
  }
  for (const path of report?.validation?.missing_field_paths ?? []) {
    paths.add(path);
  }
  for (const gap of gaps) {
    paths.add(gap.field_path);
  }

  if (analysis) {
    for (const block of AUDIT_BLOCKS) {
      const blockData = analysis[block];
      if (blockData && typeof blockData === 'object') {
        for (const key of Object.keys(blockData)) {
          paths.add(`${block}.${key}`);
        }
      }
    }
  }

  return [...paths].sort((a, b) => a.localeCompare(b, 'de'));
}

export function buildDraftAuditRows(
  report: InboundValidationReportBundle | null | undefined,
  gaps: InboundGapRecord[],
): DraftAuditFieldRow[] {
  const analysis = report?.analysis_snapshot ?? null;
  const gapByPath = new Map(gaps.map((gap) => [gap.field_path, gap.reason]));
  const missingPaths = new Set(report?.validation?.missing_field_paths ?? []);

  return collectKnownPaths(analysis, report, gaps).map((path) => {
    const raw = resolveNestedValue(analysis, path);
    const value = formatFieldValue(raw);
    const meta = auditMeta(raw);
    const hasValue = value !== null;
    const gapReason = gapByPath.get(path) ?? (missingPaths.has(path) && !hasValue
      ? 'Pflichtfeld fehlt oder ist leer.'
      : null);

    let status = classifySourceStatus(meta.source_system, hasValue);
    if (!hasValue && (missingPaths.has(path) || gapByPath.has(path))) {
      status = 'missing';
    }

    const [block] = path.split('.');

    return {
      path,
      label: FIELD_LABELS[path] ?? path.split('.').slice(1).join(' · '),
      block,
      status,
      value,
      source_system: meta.source_system,
      source_detail: meta.source_detail,
      timestamp: meta.timestamp,
      gap_reason: gapReason,
    };
  });
}

export function groupAuditRowsByBlock(rows: DraftAuditFieldRow[]): Map<string, DraftAuditFieldRow[]> {
  const grouped = new Map<string, DraftAuditFieldRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.block) ?? [];
    list.push(row);
    grouped.set(row.block, list);
  }
  return grouped;
}

export function blockLabel(block: string): string {
  return BLOCK_LABELS[block] ?? block;
}

export function sourceSystemLabel(source: string | null): string {
  if (!source) {
    return '—';
  }
  return SOURCE_SYSTEM_LABELS[source] ?? source;
}

export function auditStatusLabel(status: DraftAuditFieldRow['status']): string {
  switch (status) {
    case 'filled':
      return 'Validiert';
    case 'erp':
      return 'ERP / Excel';
    case 'pdf':
      return 'PDF / SDS';
    case 'inference':
      return 'Inferenz';
    case 'missing':
      return 'Offen';
    default:
      return status;
  }
}
