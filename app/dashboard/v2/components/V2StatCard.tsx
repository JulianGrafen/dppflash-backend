type V2StatCardProps = {
  readonly label: string;
  readonly value: number;
};

export function V2StatCard({ label, value }: V2StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-primary">{value}</p>
    </div>
  );
}
