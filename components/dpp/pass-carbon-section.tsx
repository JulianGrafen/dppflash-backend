import type {
  DppPassField,
  DppPassFieldGroup,
  DppRole,
  SampleDppPass,
} from '@/app/_data/sample-dpp.data';
import { PassCarbonScale } from '@/components/dpp/pass-carbon-scale';
import { PassDisclosure } from '@/components/dpp/pass-disclosure';
import { PassRow } from '@/components/dpp/pass-row';
import { passTokens } from '@/components/dpp/pass-tokens';
import { visibleForRole } from '@/components/dpp/pass-visibility';

export function PassCarbonSection({
  pass,
  fields,
  fieldGroups,
  role,
}: {
  pass: SampleDppPass;
  fields: DppPassField[];
  fieldGroups?: DppPassFieldGroup[];
  role: DppRole;
}) {
  const sectionFields = fields.filter(
    (f) => f.sectionId === 'carbon' && visibleForRole(f.tier, role),
  );
  const groups = new Set((fieldGroups ?? []).map((g) => g.id));
  const headlineFields = sectionFields.filter((f) => !f.group || !groups.has(f.group));
  const detailGroupId = 'carbon-detail';
  const detailTitle =
    fieldGroups?.find((g) => g.id === detailGroupId)?.title ?? 'Methodik & Studie';
  const detailFields = sectionFields.filter((f) => f.group === detailGroupId);

  return (
    <div className="flex flex-col">
      {headlineFields.length > 0 ? (
        <ul className={passTokens.listDivided}>
          {headlineFields.map((field) => (
            <PassRow
              key={field.label}
              label={field.label}
              value={field.value}
              href={field.href}
              boolean={field.boolean}
              listItems={field.listItems}
            />
          ))}
        </ul>
      ) : null}
      <PassCarbonScale
        activeClass={pass.carbonPerformanceClass ?? 'C'}
        footnote={pass.carbonPerformanceNote}
      />
      {detailFields.length > 0 ? (
        <PassDisclosure title={detailTitle}>
          <ul className={passTokens.listDivided}>
            {detailFields.map((field) => (
              <PassRow
                key={field.label}
                label={field.label}
                value={field.value}
                href={field.href}
                boolean={field.boolean}
                listItems={field.listItems}
              />
            ))}
          </ul>
        </PassDisclosure>
      ) : null}
    </div>
  );
}
