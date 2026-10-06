import { Fragment } from 'react';

import type { DppPassField } from '@/app/_data/sample-dpp.data';
import { PassRow } from '@/components/dpp/pass-row';
import { passTokens } from '@/components/dpp/pass-tokens';
import { cn } from 'cn';

/** Field list with optional in-group headings (Detailansicht blocks). */
export function PassFieldRows({ fields }: { fields: DppPassField[] }) {
  return (
    <ul className={passTokens.listDivided}>
      {fields.map((field) => (
        <Fragment key={field.key ?? field.label}>
          {field.groupHeading ? (
            <li className="list-none pt-2.5 first:pt-0">
              <p className={cn('text-[0.75rem] font-medium tracking-normal', passTokens.textAccent)}>
                {field.groupHeading}
              </p>
            </li>
          ) : null}
          <PassRow
            label={field.label}
            value={field.value}
            href={field.href}
            boolean={field.boolean}
            listItems={field.listItems}
          />
        </Fragment>
      ))}
    </ul>
  );
}
