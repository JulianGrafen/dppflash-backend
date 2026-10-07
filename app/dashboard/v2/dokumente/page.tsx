import { V2SectionShell } from '@/app/dashboard/v2/components/V2SectionShell';
import { DocumentsIngestVault } from './DocumentsIngestVault';

export default function DokumentePage() {
  return (
    <V2SectionShell
      title="Dokumente"
      description="Hochgeladene Nachweise und Extraktionsquellen — nach Ingest-Quelle als Ordner (Mock)."
    >
      <DocumentsIngestVault />
    </V2SectionShell>
  );
}
