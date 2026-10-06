'use client';

import { useParams } from 'next/navigation';
import { DraftProvider } from '@/app/dashboard/v2/context/DraftProvider';

export default function PassportDraftLayout({ children }: { readonly children: React.ReactNode }) {
  const params = useParams<{ draftId: string }>();
  const draftId = params.draftId;

  return <DraftProvider draftId={draftId}>{children}</DraftProvider>;
}
