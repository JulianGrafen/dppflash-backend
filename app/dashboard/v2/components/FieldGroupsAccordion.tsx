'use client';

import type { DraftField, FieldBlock } from '@/app/dashboard/v2/mock/types';
import { BLOCK_LABELS } from '@/app/dashboard/v2/mock/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { FieldRow } from './FieldRow';

const BLOCK_ORDER: FieldBlock[] = [
  'identification',
  'materials',
  'origin',
  'recycling',
  'technical',
  'certificates',
];

type FieldGroupsAccordionProps = {
  readonly fields: readonly DraftField[];
  readonly onConfirm: (path: string) => void;
  readonly onChange: (path: string, value: string) => void;
};

export function FieldGroupsAccordion({ fields, onConfirm, onChange }: FieldGroupsAccordionProps) {
  const byBlock = BLOCK_ORDER.map((block) => ({
    block,
    label: BLOCK_LABELS[block],
    items: fields.filter((f) => f.block === block),
  })).filter((g) => g.items.length > 0);

  return (
    <Accordion multiple defaultValue={byBlock.map((g) => g.block)} className="w-full">
      {byBlock.map((group) => (
        <AccordionItem key={group.block} value={group.block}>
          <AccordionTrigger className="cursor-pointer text-left font-semibold">
            {group.label}
          </AccordionTrigger>
          <AccordionContent>
            {group.items.map((field) => (
              <FieldRow
                key={field.path}
                field={field}
                onConfirm={() => onConfirm(field.path)}
                onChange={(value) => onChange(field.path, value)}
              />
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
