import { PassportDraftList } from '@/app/dashboard/v2/components/PassportDraftList';
import { V2SectionShell } from '@/app/dashboard/v2/components/V2SectionShell';

export default function ProduktpaessePage() {
  return (
    <V2SectionShell
      title="Produktpässe"
      description="Alle Digitalen Produktpässe in Bearbeitung und veröffentlicht."
    >
      <PassportDraftList showPublished newPassCta />
    </V2SectionShell>
  );
}
