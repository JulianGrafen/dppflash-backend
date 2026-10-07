export type AnalyticsKpi = {
  label: string;
  value: string;
  hint: string;
  trend?: string;
};

export const ANALYTICS_KPIS: AnalyticsKpi[] = [
  {
    label: 'QR-Scans (7 Tage)',
    value: '1.248',
    hint: 'Öffentliche Pass-Ansichten',
    trend: '+12 % vs. Vorwoche',
  },
  {
    label: 'Ø Vollständigkeit',
    value: '67 %',
    hint: 'Alle aktiven Produktpässe',
    trend: '+4 Pp.',
  },
  {
    label: 'Lieferanten-Response',
    value: '78 %',
    hint: 'Magic Links beantwortet (30 Tage)',
    trend: 'Ø 3,2 Tage',
  },
  {
    label: 'Offene Magic Links',
    value: '42',
    hint: 'Warten auf Supplier-Daten',
  },
];

export const COMPLETENESS_WEEKLY = [
  { label: 'KW 48', value: 41 },
  { label: 'KW 49', value: 48 },
  { label: 'KW 50', value: 52 },
  { label: 'KW 51', value: 58 },
  { label: 'KW 52', value: 61 },
  { label: 'KW 1', value: 64 },
  { label: 'KW 2', value: 67 },
] as const;

export const SCAN_WEEKLY = [
  { label: 'Mo', value: 142 },
  { label: 'Di', value: 198 },
  { label: 'Mi', value: 176 },
  { label: 'Do', value: 221 },
  { label: 'Fr', value: 189 },
  { label: 'Sa', value: 164 },
  { label: 'So', value: 158 },
] as const;

export const SUPPLIER_RESPONSE_ROWS = [
  { domain: 'shenzhen-battery.com', sent: 18, answered: 14, avgDays: 2.8 },
  { domain: 'celltech-eu.de', sent: 9, answered: 6, avgDays: 4.1 },
  { domain: 'powerpack-asia.com', sent: 12, answered: 8, avgDays: 3.5 },
  { domain: 'volt-components.nl', sent: 5, answered: 5, avgDays: 1.2 },
] as const;
