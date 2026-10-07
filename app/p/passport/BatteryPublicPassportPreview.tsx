'use client';

import { useMemo } from 'react';
import { BatteryPassView } from '@/components/dpp/battery-pass-view';
import { resolveSamplePassForProduct } from '@/app/domain/dpp/resolveSamplePassForProduct';

type BatteryPublicPassportPreviewProps = {
  readonly passId: string;
  readonly className?: string;
  readonly revision?: number;
};

/**
 * Renders the DPP-Flash public pass UI (`components/dpp`, `.dpp-pass`) for a stored pass id.
 * Prefer `/p/{id}` for a full-page view; this wrapper exists for embedded previews.
 */
export function BatteryPublicPassportPreview({
  passId,
  className,
  revision = 0,
}: BatteryPublicPassportPreviewProps) {
  const pass = useMemo(() => resolveSamplePassForProduct(passId), [passId, revision]);

  if (!pass) {
    return (
      <iframe
        title="Produktpass-Vorschau"
        src={`/p/${encodeURIComponent(passId)}`}
        className={className ?? 'h-full min-h-0 w-full border-0'}
      />
    );
  }

  return (
    <div className={className ?? 'min-h-0 w-full'}>
      <BatteryPassView pass={pass} />
    </div>
  );
}
