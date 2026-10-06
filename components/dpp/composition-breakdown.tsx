'use client';

import type {
  DppComposition,
  DppFieldTier,
  DppPassField,
  DppRole,
} from '@/app/_data/sample-dpp.data';
import { CompositionMassBar } from '@/components/dpp/composition-mass-bar';
import { usePassLocale } from '@/components/dpp/pass-locale-context';
import { PassDisclosure } from '@/components/dpp/pass-disclosure';
import { PassFieldRows } from '@/components/dpp/pass-field-rows';
import { passTokens } from '@/components/dpp/pass-tokens';
import { cn } from 'cn';

function visibleForRole(tier: DppFieldTier | undefined, role: DppRole) {
  if (!tier) return true;
  if (tier === 'public') return true;
  if (tier === 'recycler') return role === 'recycler' || role === 'auditor';
  return role === 'auditor';
}

function formatKg(kg: number) {
  return kg.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CompositionBreakdown({
  composition,
  role,
  detailFields = [],
}: {
  composition: DppComposition;
  role: DppRole;
  detailFields?: DppPassField[];
}) {
  const { ui } = usePassLocale();
  const { totalKg, segments, materials } = composition;
  const visibleMaterials = materials.filter((m) => visibleForRole(m.tier, role));
  const chemFields = detailFields.filter((f) => f.group !== 'recycled-content');
  const recycledFields = detailFields.filter((f) => f.group === 'recycled-content');

  const barSummary = segments
    .map((s) => `${s.label}: ${formatKg(s.kg)} kg (${s.percent} %)`)
    .join(', ');

  const hasCompositionDetails =
    chemFields.length > 0 || recycledFields.length > 0 || visibleMaterials.length > 0;
  return (
    <div className="space-y-4">
      <div>
        <p className={cn('mb-2 text-xs', passTokens.textMuted)}>
          {ui.massDistribution.replace('{total}', formatKg(totalKg))}
        </p>
        <CompositionMassBar segments={segments} barSummary={barSummary} />
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2" aria-label={ui.massLegendAria}>
          {segments.map((segment) => (
            <li key={segment.label} className="flex max-w-full items-center gap-1.5">
              <span
                className={cn('size-2.5 shrink-0 rounded-sm', segment.colorClass)}
                aria-hidden
              />
              <span className={cn('min-w-0 text-pretty', passTokens.textLabel)}>{segment.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {hasCompositionDetails ? (
        <PassDisclosure title={ui.compositionDetails}>
          <div className="space-y-5">
            {chemFields.length > 0 ? (
              <section>
                <h3 className={cn('mb-2 text-xs font-semibold', passTokens.textSection)}>
                  {ui.chemistryHeading}
                </h3>
                <PassFieldRows fields={chemFields} />
              </section>
            ) : null}

            {recycledFields.length > 0 ? (
              <section
                className={cn(
                  chemFields.length > 0 && passTokens.borderT,
                  chemFields.length > 0 && 'pt-4',
                )}
              >
                <h3 className={cn('mb-2 text-xs font-semibold', passTokens.textSection)}>
                  {ui.recycledHeading}
                </h3>
                <PassFieldRows fields={recycledFields} />
              </section>
            ) : null}

            {visibleMaterials.length > 0 ? (
              <section
                className={cn(
                  (chemFields.length > 0 || recycledFields.length > 0) && passTokens.borderT,
                  (chemFields.length > 0 || recycledFields.length > 0) && 'pt-4',
                )}
              >
                <h3 className={cn('mb-2 text-xs font-semibold', passTokens.textSection)}>
                  {ui.materialsHeading}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[280px] text-left text-sm">
                    <thead>
                      <tr
                        className={cn(
                          passTokens.borderB,
                          passTokens.muted,
                          'text-xs',
                          passTokens.textMuted,
                        )}
                      >
                        <th className={cn(passTokens.px, 'py-2 font-medium')}>{ui.materialColumn}</th>
                        <th className={cn(passTokens.px, 'py-2 text-right font-medium')}>{ui.shareColumn}</th>
                        <th className={cn(passTokens.px, 'py-2 text-right font-medium')}>{ui.recycledColumn}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleMaterials.map((row) => (
                        <tr key={row.label} className={cn(passTokens.borderB, 'last:border-0')}>
                          <td className={cn(passTokens.px, 'py-2', passTokens.textLabel)}>
                            {row.label}
                          </td>
                          <td
                            className={cn(
                              passTokens.px,
                              'py-2 text-right tabular-nums',
                              passTokens.textMuted,
                            )}
                          >
                            {row.share}
                          </td>
                          <td
                            className={cn(
                              passTokens.px,
                              'py-2 text-right tabular-nums',
                              passTokens.textMuted,
                            )}
                          >
                            {row.recycled ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </div>
        </PassDisclosure>
      ) : null}
    </div>
  );
}
