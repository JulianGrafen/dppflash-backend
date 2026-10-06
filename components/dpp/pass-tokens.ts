/** Scoped design tokens for the public battery pass (.dpp-pass). */
export const passTokens = {
  page: 'bg-[#eef1f6] text-[#1a2b4a]',
  surface: 'bg-white',
  muted: 'bg-[#f8fafc]',
  border: 'border-[#e8ecf2]',
  borderB: 'border-b border-[#e8ecf2]',
  borderT: 'border-t border-[#e8ecf2]',
  divide: 'divide-[#e8ecf2]',
  listDivided: 'flex flex-col divide-y divide-[#e8ecf2]',
  px: 'px-4',
  card: 'overflow-hidden rounded-xl border border-[#e8ecf2] bg-white shadow-sm',
  kpiBox:
    'flex min-h-[5.25rem] min-w-0 flex-col items-stretch justify-start rounded-xl border border-[#e8ecf2] bg-[#f8fafc] px-2 py-2.5 text-center shadow-sm sm:min-h-[5.5rem] sm:px-2.5',
  kpiLabelSlot: 'flex min-h-8 w-full items-end justify-center pb-0.5',
  kpiValueSlot: 'flex min-h-[2.65rem] w-full items-start justify-center pt-0.5',
  textAccent: 'text-[#2563eb]',
  textLink: 'text-[#4f46e5]',
  textMuted: 'text-[#64748b]',
  textLabel: 'text-[0.68rem] font-medium leading-snug text-[#64748b]',
  textRowValue: 'text-[0.75rem] font-normal leading-snug text-[#1a2b4a]',
  textValue:
    'shrink-0 max-w-[9rem] truncate text-right text-[0.72rem] font-semibold leading-snug text-[#1a2b4a] sm:max-w-[11rem]',
  textSection:
    'text-[0.8125rem] font-medium tracking-normal text-[#1d4ed8] normal-case',
  textKpiLabel:
    'w-full text-center text-[0.68rem] font-bold uppercase tracking-wide text-[#475569] sm:text-[0.72rem]',
  textKpiValue:
    'w-full text-center text-balance line-clamp-2 text-[0.95rem] font-medium leading-tight text-[#1a2b4a] sm:text-[1.05rem]',
  cta:
    'flex h-11 w-full items-center justify-center rounded-xl text-[0.88rem] font-extrabold text-white bg-gradient-to-br from-[#7c5cff] to-[#5b6cff] shadow-[0_8px_24px_rgba(91,108,255,0.25)]',
  headerActionBtn:
    'mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-[#2563eb] bg-[#eff6ff] px-4 text-[0.8125rem] font-semibold text-[#1d4ed8] no-underline shadow-sm transition-colors hover:bg-[#dbeafe] active:bg-[#bfdbfe] sm:w-auto',
  rowActionBtn:
    'inline-flex h-8 w-[5.5rem] shrink-0 items-center justify-center rounded-md border border-[#2563eb] bg-[#eff6ff] px-2 text-center text-[0.75rem] font-semibold text-[#1d4ed8] no-underline shadow-sm transition-colors hover:bg-[#dbeafe] active:bg-[#bfdbfe]',
} as const;
