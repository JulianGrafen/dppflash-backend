import type { DppProductPassport } from '@/app/domain/dpp/dppSchema';
import type {
  DppValidationContext,
  DppValidationRule,
  ValidationFinding,
} from '@/app/domain/dpp/validation/DppValidationTypes';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function includesComponent(materials: readonly string[], requiredComponent: string): boolean {
  const normalizedRequiredComponent = normalize(requiredComponent);
  return materials.some((material) => normalize(material).includes(normalizedRequiredComponent));
}

export class AdhesiveChemicalComponentsRule implements DppValidationRule {
  readonly name = 'AdhesiveChemicalComponentsRule';

  validate(dpp: DppProductPassport, context: DppValidationContext): readonly ValidationFinding[] {
    const productType = dpp.declaredProductType;

    if (!productType) {
      return [];
    }

    const requiredBaseComponents = context.chemicalKnowledge.getRequiredBaseComponents(productType);

    if (requiredBaseComponents.length === 0) {
      return [];
    }

    const materialNames = dpp.materialComposition.map((entry) => entry.material);
    const missingComponents = requiredBaseComponents.filter(
      (requiredComponent) => !includesComponent(materialNames, requiredComponent),
    );

    if (missingComponents.length === 0) {
      return [];
    }

    return [{
      severity: 'warning',
      code: 'DPP_ADHESIVE_BASE_COMPONENTS_MISSING',
      field: 'materialComposition',
      message: `Declared product type "${productType}" should contain adhesive base components: ${missingComponents.join(', ')}.`,
    }];
  }
}
