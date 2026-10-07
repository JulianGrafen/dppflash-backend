import { Card, CardContent } from '@/components/ui/card';

type V2StatCardProps = {
  readonly label: string;
  readonly value: number;
};

export function V2StatCard({ label, value }: V2StatCardProps) {
  return (
    <Card className="border-slate-200/90 shadow-sm">
      <CardContent className="px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-primary">{value}</p>
      </CardContent>
    </Card>
  );
}
