import type { ChemicalComponentKnowledgePort } from '@/app/domain/dpp/validation/DppValidationTypes';

const REQUIRED_BASE_COMPONENTS_BY_PRODUCT_TYPE: Readonly<Record<string, readonly string[]>> = {
  klebstoff: ['polymer', 'harz', 'bindemittel'],
  adhesive: ['polymer', 'resin', 'binder'],
};

export class DefaultChemicalComponentKnowledge implements ChemicalComponentKnowledgePort {
  getRequiredBaseComponents(productType: string): readonly string[] {
    return REQUIRED_BASE_COMPONENTS_BY_PRODUCT_TYPE[productType.trim().toLowerCase()] ?? [];
  }
}
