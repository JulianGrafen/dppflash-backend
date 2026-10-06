import type { BatteryDPP } from '@/app/types/dpp-types';
import { mapPassportFieldsToBatteryDPP } from './mapPassportFieldsToBatteryDPP';
import type { PassportFieldValueState } from '@/app/dashboard/v2/mock/types';

/** View-model entry for shared public passport rendering (editor preview + `/p`). */
export function toBatteryPassportViewModel(
  fields: Record<string, PassportFieldValueState>,
  options?: { productName?: string; passId?: string },
): BatteryDPP {
  return mapPassportFieldsToBatteryDPP(fields, options);
}
