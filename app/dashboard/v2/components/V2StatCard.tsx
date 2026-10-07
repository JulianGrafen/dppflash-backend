import { Card, CardContent } from '@/components/ui/card';
import { EnterMotion } from '@/components/ui/enter-motion';

type V2StatCardProps = {
  readonly label: string;
  readonly value: number;
  readonly delayMs?: number;
};

export function V2StatCard({ label, value, delayMs = 0 }: V2StatCardProps) {
  return (
    <EnterMotion delayMs={delayMs}>
    <Card variant="elevated" className="border-slate-200/90">
      <CardContent className="px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-primary">{value}</p>
      </CardContent>
    </Card>
    </EnterMotion>
  );
}
