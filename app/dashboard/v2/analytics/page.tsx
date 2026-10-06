import { V2SectionShell } from '@/app/dashboard/v2/components/V2SectionShell';
import { Card, CardContent } from '@/components/ui/card';

export default function AnalyticsPage() {
  return (
    <V2SectionShell
      title="Analytics"
      description="Nutzung und Scan-Statistiken — in dieser Demo nicht angebunden."
    >
      <Card className="border-dashed border-slate-200 bg-white/80 shadow-sm">
        <CardContent className="py-12 text-center text-sm text-slate-500">
          Platzhalter für KPIs (Scans, Vollständigkeit über Zeit, Lieferanten-Response).
        </CardContent>
      </Card>
    </V2SectionShell>
  );
}
