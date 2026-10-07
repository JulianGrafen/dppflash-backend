export type PassportSupplierSuggestion = {
  supplierHint: string;
  supplierEmail: string;
};

const BY_FIELD_KEY: Record<string, PassportSupplierSuggestion> = {
  'battery.uniqueId': {
    supplierHint: 'Nordic Cathode Materials AB',
    supplierEmail: 'dpp@nordic-cathode.example',
  },
  'operator.economicOperatorId': {
    supplierHint: 'Rheinwerk Cycles GmbH',
    supplierEmail: 'compliance@rheinwerk.example',
  },
  'battery.manufacturer': {
    supplierHint: 'Rheinwerk Cycles GmbH',
    supplierEmail: 'compliance@rheinwerk.example',
  },
  'manufacturing.place': {
    supplierHint: 'Werksstandort Köln (Tier-1)',
    supplierEmail: 'plant-koeln@rheinwerk.example',
  },
  'compliance.separateCollectionSymbol': {
    supplierHint: 'Label Solutions EU GmbH',
    supplierEmail: 'labels@label-solutions.example',
  },
  'carbonFootprint.total': {
    supplierHint: 'Climate Analytics Partners',
    supplierEmail: 'dpp@climate-analytics.example',
  },
};

export function suggestedSupplierForPassportField(_key: string): PassportSupplierSuggestion {
  return (
    BY_FIELD_KEY[_key] ?? {
      supplierHint: 'Tier-1 Batterielieferant (Demo)',
      supplierEmail: 'compliance@supplier-eu.example',
    }
  );
}
