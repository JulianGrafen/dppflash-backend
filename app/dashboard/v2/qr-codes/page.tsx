'use client';

import { V2SectionShell } from '@/app/dashboard/v2/components/V2SectionShell';
import { QrCodesExportPanel } from './QrCodesExportPanel';

export default function QrCodesPage() {
  return (
    <V2SectionShell
      title="QR-Codes"
      description="Scan-Links und Export für Ihre Produkte — PNG/SVG für Druck, CSV/JSON für ERP und Etiketten (Demo)."
    >
      <QrCodesExportPanel />
    </V2SectionShell>
  );
}
