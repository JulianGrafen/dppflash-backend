'use client';

import { PassAnimatedKpiValue } from '@/components/dpp/pass-animated-kpi-value';
import { usePassLocale } from '@/components/dpp/pass-locale-context';
import { passTokens } from '@/components/dpp/pass-tokens';
import { cn } from 'cn';

export function PassKeyMetrics({
  capacity,
  cycleLife,
  carbonFootprint,
}: {
  capacity: string;
  cycleLife: string;
  carbonFootprint: string;
}) {
  const { ui } = usePassLocale();
  const items = [
    { label: ui.kpiCapacity, value: capacity },
    { label: ui.kpiCycles, value: cycleLife },
    { label: ui.kpiCo2, value: carbonFootprint },
  ];

  return (
    <div className={cn(passTokens.px, 'pb-3 pt-0')}>
      <div
        className="grid grid-cols-3 items-stretch gap-2"
        role="list"
        aria-label={ui.kpiAria}
      >
        {items.map((item, index) => (
          <div key={item.label} role="listitem" className={passTokens.kpiBox}>
            <div className={passTokens.kpiLabelSlot}>
              <p className={passTokens.textKpiLabel}>{item.label}</p>
            </div>
            <div className={passTokens.kpiValueSlot}>
              <PassAnimatedKpiValue value={item.value} delayMs={index * 90} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
