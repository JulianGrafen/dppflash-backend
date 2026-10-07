import { Suspense } from 'react';
import { ProduktpassHub } from '@/app/dashboard/v2/components/ProduktpassHub';
import { V2SectionShell } from '@/app/dashboard/v2/components/V2SectionShell';

export default function ProduktpaessePage() {
  return (
    <V2SectionShell
      title="Produktpässe"
      description="Pässe, Produkte, Vollständigkeit und Lieferanten an einem Ort."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Laden…</p>}>
        <ProduktpassHub />
      </Suspense>
    </V2SectionShell>
  );
}
