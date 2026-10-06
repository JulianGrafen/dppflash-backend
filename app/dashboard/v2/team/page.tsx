import { V2SectionShell } from '@/app/dashboard/v2/components/V2SectionShell';
import { Card, CardContent } from '@/components/ui/card';

export default function TeamPage() {
  return (
    <V2SectionShell
      title="Team"
      description="Rollen und Zugriff für Ihre Organisation — Mock."
    >
      <Card className="border-slate-200/90 shadow-sm">
        <CardContent className="py-10 text-center text-sm text-slate-500">
          Teamverwaltung folgt in einer späteren Version. Aktuell: ein Demo-Benutzer pro Browser-Session.
        </CardContent>
      </Card>
    </V2SectionShell>
  );
}
