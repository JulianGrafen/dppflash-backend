import type { SampleDppPass, DppPassField } from '@/app/_data/sample-dpp.data';
import type { PassLocale } from '@/lib/pass-locale';
import {
  getVoltstride720PassOverlay,
  getVoltstride720Ui,
} from '@/app/_data/voltstride-720-locale';

function fieldId(field: DppPassField): string {
  return field.key ?? `label:${field.label}`;
}

function mapFields(
  fields: DppPassField[],
  locale: PassLocale,
  overlay: ReturnType<typeof getVoltstride720PassOverlay>,
): DppPassField[] {
  if (locale === 'de' || !overlay) return fields;
  return fields.map((field) => {
    const tr = overlay.fields[fieldId(field)];
    if (!tr) return field;
    return {
      ...field,
      label: tr.label ?? field.label,
      value: tr.value ?? field.value,
      groupHeading: tr.groupHeading ?? field.groupHeading,
      listItems: tr.listItems ?? field.listItems,
    };
  });
}

export function getPassUiStrings(slug: string, locale: PassLocale) {
  if (slug === 'voltstride-720') return getVoltstride720Ui(locale);
  return getVoltstride720Ui('de');
}

export function localizeSamplePass(pass: SampleDppPass, locale: PassLocale): SampleDppPass {
  if (locale === 'de' || pass.slug !== 'voltstride-720') return pass;

  const overlay = getVoltstride720PassOverlay(locale);
  if (!overlay) return pass;

  return {
    ...pass,
    category: overlay.category ?? pass.category,
    shortDescription: overlay.shortDescription ?? pass.shortDescription,
    batteryStatusNote: overlay.batteryStatusNote ?? pass.batteryStatusNote,
    cycleLife: overlay.cycleLife ?? pass.cycleLife,
    carbonFootprintUnit: overlay.carbonFootprintUnit ?? pass.carbonFootprintUnit,
    carbonPerformanceNote: overlay.carbonPerformanceNote ?? pass.carbonPerformanceNote,
    dataAsOf: overlay.dataAsOf ?? pass.dataAsOf,
    imageAlt: overlay.imageAlt ?? pass.imageAlt,
    profileStatusHint: overlay.profileStatusHint ?? pass.profileStatusHint,
    recyclability: overlay.recyclability ?? pass.recyclability,
    warranty: overlay.warranty ?? pass.warranty,
    contentSections: pass.contentSections?.map((section) => {
      const tr = overlay.sections[section.id];
      if (!tr) return section;
      return {
        ...section,
        title: tr.title ?? section.title,
        headerAction:
          section.headerAction && tr.headerActionLabel
            ? { ...section.headerAction, label: tr.headerActionLabel }
            : section.headerAction,
      };
    }),
    composition: {
      ...pass.composition,
      segments: pass.composition.segments.map((segment, index) => ({
        ...segment,
        label: overlay.compositionSegments[index] ?? segment.label,
      })),
      materials: pass.composition.materials.map((material, index) => ({
        ...material,
        label: overlay.compositionMaterials[index]?.label ?? material.label,
        recycled: overlay.compositionMaterials[index]?.recycled ?? material.recycled,
      })),
    },
    publicSection: {
      ...pass.publicSection,
      title: overlay.publicSectionTitle ?? pass.publicSection.title,
      fieldGroups: pass.publicSection.fieldGroups?.map((group) => ({
        ...group,
        title: overlay.fieldGroups[group.id] ?? group.title,
      })),
      fields: mapFields(pass.publicSection.fields, locale, overlay),
    },
    accessSection: pass.accessSection
      ? {
          ...pass.accessSection,
          title: overlay.accessSectionTitle ?? pass.accessSection.title,
          fields: mapFields(pass.accessSection.fields, locale, overlay),
        }
      : pass.accessSection,
  };
}
