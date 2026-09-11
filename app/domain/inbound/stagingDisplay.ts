export type StagingStatus = 'PENDING' | 'ORPHAN' | 'CONFLICT' | 'PROCESSED';

export const STAGING_STATUS_LABELS: Record<StagingStatus, string> = {
  PENDING: 'Ausstehend',
  ORPHAN: 'Ohne ID',
  CONFLICT: 'Konflikt',
  PROCESSED: 'Verarbeitet',
};

export const PRODUCT_CATEGORY_LABELS: Record<string, string> = {
  TEXTILES_APPAREL: 'Textilien / Bekleidung',
  ELECTRONICS: 'Elektronik',
  BATTERIES: 'Batterien',
  GENERIC: 'Allgemein',
};

export const STAGING_SOURCE_LABELS: Record<string, string> = {
  ERP_WEBHOOK: 'ERP Webhook',
  CSV_UPLOAD: 'CSV/Excel',
  PDF_EXTRACT: 'PDF',
  PIM_WEBHOOK: 'PIM Webhook',
};

export function stagingStatusBadgeClass(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'bg-amber-100 text-amber-900';
    case 'ORPHAN':
      return 'bg-violet-100 text-violet-900';
    case 'CONFLICT':
      return 'bg-red-100 text-red-900';
    case 'PROCESSED':
      return 'bg-emerald-100 text-emerald-900';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}
