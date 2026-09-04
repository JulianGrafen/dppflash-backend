export interface SapMasterDataInput {
  sku: string;
  gtin: string;
  product_name: string;
  manufacturer_name: string;
  taric_code: string;
}

export interface PipelineGap {
  field_path: string;
  reason: string;
  severity: 'critical' | 'major' | 'minor';
}

export interface PipelineValidationReport {
  status: string;
  is_complete: boolean;
  mass_balance_ok: boolean;
  mass_balance_total_percent: number | null;
  readiness_score_percent: number;
  missing_field_paths: string[];
  issues: string[];
}

export interface PipelineEspAuditReport {
  is_fully_compliant: boolean;
  readiness_score_percent: number;
  co2_mapping_applied: boolean;
  co2_notes: string | null;
  missing_field_paths: string[];
}

export interface PipelineEnrichmentResult {
  stage: string;
  success: boolean;
  filled_field_paths: string[];
  remaining_gaps: PipelineGap[];
  notes: string | null;
}

export interface PipelineDbPersistResult {
  record_id: string;
  compliance_status: string;
  persisted_at: string;
  notes: string | null;
}

export interface PipelineExtractedData {
  product_category?: string;
  identification?: Record<string, unknown>;
  economic_operator?: Record<string, unknown>;
  product_details?: Record<string, unknown>;
  sustainability?: Record<string, unknown>;
  system_requirements?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface PipelineResult {
  extracted_data: PipelineExtractedData | null;
  validation_status: string;
  validation_report: PipelineValidationReport | null;
  espr_audit_report: PipelineEspAuditReport | null;
  gaps: PipelineGap[];
  gap_remediation: {
    product_identifier: string | null;
    gap_count: number;
    gaps: PipelineGap[];
    recommended_actions: string[];
  } | null;
  enrichment_stage: string;
  enrichment_result: PipelineEnrichmentResult | null;
  supplier_email?: AuditFieldPayload | null;
  email_found?: boolean;
  compliance_status: string;
  db_persist_result: PipelineDbPersistResult | null;
  extraction_attempt: number;
  errors: string[];
  metadata: Record<string, unknown>;
}

export interface AuditFieldPayload {
  value: string | boolean | number | null;
  source_system: string;
  source_detail: string | null;
  timestamp: string | null;
}

export interface DppFieldRow {
  path: string;
  label: string;
  value: string | null;
  status: 'filled' | 'sap' | 'missing' | 'empty';
  block: string;
  source_system?: string | null;
  source_detail?: string | null;
}

export const SAP_FIELD_LABELS: Record<keyof SapMasterDataInput, string> = {
  sku: 'Artikelnummer (SKU)',
  gtin: 'GTIN / EAN',
  product_name: 'Produktbezeichnung',
  manufacturer_name: 'Hersteller (Stammdaten)',
  taric_code: 'TARIC / Zolltarif',
};

export const BLOCK_LABELS: Record<string, string> = {
  identification: 'Identifikation',
  economic_operator: 'Wirtschaftsbeteiligter',
  product_details: 'Produktdetails',
  sustainability: 'Nachhaltigkeit & Kreislauf',
  system_requirements: 'Systemanforderungen',
};

export const FIELD_LABELS: Record<string, string> = {
  'identification.unique_product_identifier': 'Eindeutige Produkt-ID (UPI)',
  'identification.data_carrier_type': 'Datenträger-Typ',
  'identification.gtin_or_equivalent': 'GTIN / EAN',
  'identification.commodity_code_taric': 'TARIC / HS-Code',
  'identification.unique_facility_identifier': 'Anlagen-ID',
  'identification.link_to_previous_dpps': 'Link zu früheren DPPs',
  'economic_operator.manufacturer_name': 'Hersteller',
  'economic_operator.manufacturer_address': 'Herstelleradresse',
  'economic_operator.electronic_contact_details': 'Elektronischer Kontakt',
  'economic_operator.unique_operator_identifier': 'Betreiber-ID (EORI)',
  'sustainability.material_composition': 'Materialzusammensetzung',
  'sustainability.end_of_life_treatment': 'Entsorgung / End-of-Life',
  'sustainability.environmental_footprint': 'Umweltfußabdruck',
  'sustainability.durability_reliability': 'Haltbarkeit / Zuverlässigkeit',
  'sustainability.repairability_info': 'Reparierbarkeit',
  'sustainability.recyclability_info': 'Recyclingfähigkeit',
  'sustainability.resource_use': 'Ressourcennutzung',
  'sustainability.resource_efficiency': 'Ressourceneffizienz',
  'product_details.product_weight': 'Produktgewicht',
  'product_details.product_dimensions': 'Abmessungen',
  'product_details.warnings_safety_information': 'Warnhinweise / Sicherheit',
  'system_requirements.availability_duration': 'Verfügbarkeitsdauer DPP',
  'system_requirements.eu_declaration_of_conformity': 'EU-Konformitätserklärung',
};

export const SAMPLE_SAP_DATA: SapMasterDataInput = {
  sku: '670689',
  gtin: '4012345678901',
  product_name: 'Cimsec Fliesen Kleber S1 Flex Schnell',
  manufacturer_name: 'Muster Klebstoff GmbH',
  taric_code: '3214 10 10',
};

export const SAMPLE_SDS_TEXT = `Sicherheitsdatenblatt
Produktname: Cimsec Fliesen Kleber S1 Flex Schnell
Hersteller: Muster Klebstoff GmbH
Adresse: Industriestr. 12, 12345 Musterstadt, Deutschland

Abschnitt 3 — Zusammensetzung:
Quarz 50%, Portlandzement 30%, Wasser 20%

Abschnitt 13 — Entsorgung:
Restentleerte Gebinde der Wiederverwertung zuführen.
Abfallschlüssel: 08 04 09*

Abschnitt 2 — Warnhinweise:
Enthält Zement. Verursacht Hautreizungen. P280, P302+P352.`;

/** SAP S/4 A_Product OData sample — contacts live under BOM → Purchasing → SupplierDetails. */
export const SAMPLE_SAP_PRODUCT_ODATA: Record<string, unknown> = {
  d: {
    Product: '000000000010048921',
    NetWeight: '25.000',
    WeightUnit: 'KG',
    CountryOfOrigin: 'DE',
    CommodityCode: '35069190',
    StandardIdentifier: {
      ProductStandardID: '04001234987654',
      InternationalArticleNumberCat: 'EAN',
    },
    to_Description: {
      results: [
        {
          Language: 'DE',
          ProductDescription: 'LOCTITE IND-SEAL 400 - Gebinde 25KG',
        },
      ],
    },
    to_BillOfMaterial: {
      results: [
        {
          BillOfMaterial: '00012844',
          to_BOMItems: {
            results: [
              {
                BOMItemNumber: '0010',
                ComponentDescription: 'Vorpolymer Polyol Type P-40',
                to_PurchasingInfo: {
                  Supplier: '0000100452',
                  SupplierName: 'Covestro Deutschland AG',
                  to_SupplierDetails: {
                    DefaultEmailAddress: 'rechnungseingang@covestro.corp',
                    to_ContactPerson: {
                      results: [
                        {
                          FirstName: 'Stefan',
                          LastName: 'Meier',
                          Department: 'Technical Sales Coatings & Adhesives',
                          EmailAddress: 'stefan.meier@covestro.corp',
                        },
                      ],
                    },
                  },
                },
              },
              {
                BOMItemNumber: '0020',
                ComponentDescription: 'Kreide-Füllstoff Calcit Micron',
                to_PurchasingInfo: {
                  Supplier: '0000103891',
                  SupplierName: 'Omya GmbH',
                  to_SupplierDetails: {
                    DefaultEmailAddress: 'info.germany@omya.corp',
                    to_ContactPerson: { results: [] },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  },
};


export function isAuditField(value: unknown): value is AuditFieldPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return 'value' in record && 'source_system' in record && 'source_detail' in record;
}

export function unwrapAuditValue(value: unknown): unknown {
  if (isAuditField(value)) {
    return value.value;
  }
  return value;
}

export function auditProvenance(value: unknown): Pick<AuditFieldPayload, 'source_system' | 'source_detail'> | null {
  if (!isAuditField(value)) {
    return null;
  }
  return {
    source_system: value.source_system,
    source_detail: value.source_detail,
  };
}

function formatValue(value: unknown): string | null {
  const unwrapped = unwrapAuditValue(value);
  if (unwrapped === null || unwrapped === undefined) {
    return null;
  }
  if (typeof unwrapped === 'boolean') {
    return unwrapped ? 'Ja' : 'Nein';
  }
  if (typeof unwrapped === 'number') {
    return String(unwrapped);
  }
  if (typeof unwrapped === 'string') {
    return unwrapped.trim() || null;
  }
  if (Array.isArray(unwrapped)) {
    return unwrapped.length > 0 ? JSON.stringify(unwrapped) : null;
  }
  if (typeof unwrapped === 'object') {
    return null;
  }
  return String(unwrapped);
}

function resolveNestedValue(data: PipelineExtractedData | null, dotPath: string): unknown {
  if (!data) {
    return null;
  }
  const [block, field] = dotPath.split('.');
  const blockData = data[block as keyof PipelineExtractedData];
  if (!blockData || typeof blockData !== 'object') {
    return null;
  }
  return (blockData as Record<string, unknown>)[field];
}

export function formatDisplayValue(value: unknown): string | null {
  return formatValue(value);
}

export function buildDppFieldRows(result: PipelineResult): DppFieldRow[] {
  const extracted = result.extracted_data;
  const gapPaths = new Set(result.gaps.map((gap) => gap.field_path));
  const sapFilled = new Set(result.enrichment_result?.filled_field_paths ?? []);

  const paths = new Set<string>();
  if (extracted) {
    for (const block of ['identification', 'economic_operator', 'product_details', 'sustainability', 'system_requirements'] as const) {
      const blockData = extracted[block];
      if (blockData && typeof blockData === 'object') {
        for (const key of Object.keys(blockData)) {
          if (key === 'category') {
            continue;
          }
          paths.add(`${block}.${key}`);
        }
      }
    }
  }
  for (const gap of result.gaps) {
    paths.add(gap.field_path);
  }
  for (const missing of result.validation_report?.missing_field_paths ?? []) {
    paths.add(missing);
  }
  paths.add('economic_operator.electronic_contact_details');

  const sortedPaths = [...paths].sort((a, b) => a.localeCompare(b, 'de'));

  return sortedPaths.map((path) => {
    const raw = resolveNestedValue(extracted, path);
    const value = formatValue(raw);
    const provenance = auditProvenance(raw);
    const [block] = path.split('.');
    let status: DppFieldRow['status'] = 'empty';

    if (
      (gapPaths.has(path) || (result.validation_report?.missing_field_paths ?? []).includes(path)) &&
      !value
    ) {
      status = 'missing';
    } else if (value) {
      const fromSap =
        provenance?.source_system &&
        provenance.source_system !== 'DOCUMENT_SDS' &&
        provenance.source_system !== 'SYSTEM_INFERENCE';
      status = fromSap || sapFilled.has(path) ? 'sap' : 'filled';
    }

    return {
      path,
      label: FIELD_LABELS[path] ?? path.split('.').slice(1).join(' · '),
      value,
      status,
      block,
      source_system: provenance?.source_system ?? null,
      source_detail: provenance?.source_detail ?? null,
    };
  });
}

export function groupFieldRowsByBlock(rows: DppFieldRow[]): Map<string, DppFieldRow[]> {
  const grouped = new Map<string, DppFieldRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.block) ?? [];
    list.push(row);
    grouped.set(row.block, list);
  }
  return grouped;
}

export function complianceStatusLabel(status: string): string {
  switch (status) {
    case 'approved':
      return 'Freigegeben';
    case 'pending_review':
      return 'Manuelle Prüfung';
    case 'draft':
      return 'Entwurf';
    default:
      return status;
  }
}

export function enrichmentStageLabel(stage: string): string {
  switch (stage) {
    case 'none':
      return 'Keine Anreicherung';
    case 'api_lookup':
      return 'SAP / API Lookup';
    case 'sap_email_lookup':
      return 'SAP Lieferanten-E-Mail';
    case 'supplier_outreach':
      return 'Lieferanten-Anfrage';
    case 'escalated':
      return 'Eskaliert';
    default:
      return stage;
  }
}
