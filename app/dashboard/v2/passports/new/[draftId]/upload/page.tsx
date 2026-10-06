'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState } from 'react';
import { useDraft } from '@/app/dashboard/v2/context/DraftProvider';
import { DocumentDropzone } from '@/app/dashboard/v2/components/DocumentDropzone';
import { WizardLayout } from '../WizardLayout';
import { simulateDocumentPipeline } from '@/app/dashboard/v2/mock/simulateExtraction';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function UploadStepPage() {
  const { draft, replace } = useDraft();
  const router = useRouter();
  const params = useParams<{ draftId: string }>();
  const [processing, setProcessing] = useState(false);

  async function handleFiles(names: string[]) {
    if (!draft || processing) {
      return;
    }
    setProcessing(true);
    await simulateDocumentPipeline(draft, names, (updated) => {
      replace(updated);
    });
    setProcessing(false);
    router.push(`/dashboard/v2/passports/new/${params.draftId}/review-data`);
  }

  return (
    <WizardLayout>
      <Card>
        <CardHeader>
          <CardTitle>Dokumente hochladen</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentDropzone
            documents={draft?.documents ?? []}
            disabled={processing}
            onFiles={handleFiles}
          />
          {draft && draft.fields.length > 0 ? (
            <p className="mt-4 text-sm text-emerald-700">Extraktion abgeschlossen — weiter zu den Daten.</p>
          ) : null}
        </CardContent>
      </Card>
    </WizardLayout>
  );
}
