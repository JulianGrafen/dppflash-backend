'use client';

import { useMemo } from 'react';
import type { PassportFieldValueState } from '@/app/dashboard/v2/mock/types';
import { resolveSamplePassFromEditorFields } from '@/app/domain/dpp/resolveSamplePassForProduct';
import { BatteryPassView } from '@/components/dpp/battery-pass-view';

type BatteryPassPreviewFromDraftProps = {
  readonly passportFields: Record<string, PassportFieldValueState>;
  readonly productName?: string;
  readonly passId: string;
};

export function BatteryPassPreviewFromDraft({
  passportFields,
  productName,
  passId,
}: BatteryPassPreviewFromDraftProps) {
  const pass = useMemo(
    () => resolveSamplePassFromEditorFields(passportFields, { productName, passId }),
    [passportFields, productName, passId],
  );

  return <BatteryPassView pass={pass} />;
}
