import type { SampleDppPass } from '@/app/_data/sample-dpp.data';
import { BatteryPassClient } from '@/components/dpp/battery-pass-client';
import { PassLocaleProvider } from '@/components/dpp/pass-locale-context';

export function BatteryPassView({ pass }: { pass: SampleDppPass }) {
  return (
    <PassLocaleProvider pass={pass}>
      <BatteryPassClient />
    </PassLocaleProvider>
  );
}
