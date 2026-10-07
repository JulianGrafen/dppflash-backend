export type IngestFileKind = 'pdf' | 'zip' | 'xlsx' | 'csv' | 'json' | 'docx' | 'jpg' | 'api';

export type IngestDocumentFile = {
  id: string;
  name: string;
  kind: IngestFileKind;
  sizeLabel: string;
  status: 'indexed' | 'extracted' | 'linked';
  fieldsLinked?: number;
  ingestedAt: string;
};

export type IngestDocumentFolder = {
  id: string;
  name: string;
  description: string;
  files: IngestDocumentFile[];
};

export function buildIngestDocumentVault(companyDomain: string): IngestDocumentFolder[] {
  const inbox = `import-data@${companyDomain}.dppflash.com`;

  return [
    {
      id: 'compliance-inbox',
      name: inbox,
      description: 'Compliance Inbox · ZIP/PDF aus Onboarding & Lieferanten-Mail',
      files: [
        {
          id: 'inbox-1',
          name: 'UN38.3_batch_2025-Q4.zip',
          kind: 'zip',
          sizeLabel: '48 MB',
          status: 'extracted',
          fieldsLinked: 186,
          ingestedAt: '2025-12-18T09:14:00Z',
        },
        {
          id: 'inbox-2',
          name: 'BAT-PRO-27_transport-test-summary.pdf',
          kind: 'pdf',
          sizeLabel: '2,1 MB',
          status: 'extracted',
          fieldsLinked: 24,
          ingestedAt: '2025-12-18T09:16:00Z',
        },
        {
          id: 'inbox-3',
          name: 'SCOOT-BAT-V2_SDS_bundle.pdf',
          kind: 'pdf',
          sizeLabel: '890 KB',
          status: 'extracted',
          fieldsLinked: 31,
          ingestedAt: '2025-12-19T14:02:00Z',
        },
        {
          id: 'inbox-4',
          name: 'supplier_labels_scan_pack.zip',
          kind: 'zip',
          sizeLabel: '12 MB',
          status: 'indexed',
          ingestedAt: '2026-01-05T11:30:00Z',
        },
      ],
    },
    {
      id: 'akeneo-pim',
      name: 'Akeneo PIM — Master Export',
      description: 'Strukturierte Stammdaten · 4.250 SKUs (Global Sync)',
      files: [
        {
          id: 'pim-1',
          name: 'catalog_snapshot_full.json',
          kind: 'json',
          sizeLabel: '18 MB',
          status: 'linked',
          fieldsLinked: 4250,
          ingestedAt: '2025-12-18T09:12:00Z',
        },
        {
          id: 'pim-2',
          name: 'attributes_battery_family.xlsx',
          kind: 'xlsx',
          sizeLabel: '4,6 MB',
          status: 'linked',
          fieldsLinked: 892,
          ingestedAt: '2025-12-18T09:12:00Z',
        },
      ],
    },
    {
      id: 'xentral-erp',
      name: 'Xentral ERP — Bestand & SKU',
      description: 'ERP-Sync · Artikelnummern & EAN',
      files: [
        {
          id: 'erp-1',
          name: 'inventory_positions_sync.csv',
          kind: 'csv',
          sizeLabel: '1,2 MB',
          status: 'linked',
          fieldsLinked: 4250,
          ingestedAt: '2025-12-18T09:11:00Z',
        },
        {
          id: 'erp-2',
          name: 'purchase_orders_open.xlsx',
          kind: 'xlsx',
          sizeLabel: '640 KB',
          status: 'indexed',
          ingestedAt: '2025-12-20T08:00:00Z',
        },
      ],
    },
    {
      id: 'llm-extraction',
      name: 'AI Merge — Magic Inbox',
      description: 'LLM-Extraktion UN 38.3 · gemerged mit PIM-SKUs',
      files: [
        {
          id: 'llm-1',
          name: 'extraction_run_global_sync.json',
          kind: 'json',
          sizeLabel: '6,8 MB',
          status: 'extracted',
          fieldsLinked: 1150,
          ingestedAt: '2025-12-18T09:18:00Z',
        },
        {
          id: 'llm-2',
          name: 'gap_candidates_supplier_outreach.csv',
          kind: 'csv',
          sizeLabel: '220 KB',
          status: 'linked',
          fieldsLinked: 1150,
          ingestedAt: '2025-12-18T09:19:00Z',
        },
      ],
    },
    {
      id: 'product-ebike',
      name: 'Produktpass · E-Bike Battery Pro',
      description: 'Wizard & Audit-Trail Quellen (BAT-2027-X)',
      files: [
        {
          id: 'pp-1',
          name: 'EU-Konformitätserklärung_VoltStride.pdf',
          kind: 'pdf',
          sizeLabel: '1,4 MB',
          status: 'extracted',
          fieldsLinked: 12,
          ingestedAt: '2025-11-02T10:00:00Z',
        },
        {
          id: 'pp-2',
          name: 'BOM_VoltStride_720_v3.xlsx',
          kind: 'xlsx',
          sizeLabel: '2,8 MB',
          status: 'extracted',
          fieldsLinked: 18,
          ingestedAt: '2025-11-02T10:05:00Z',
        },
        {
          id: 'pp-3',
          name: 'ISO14067_CarbonStudy_VoltStride.pdf',
          kind: 'pdf',
          sizeLabel: '3,2 MB',
          status: 'extracted',
          fieldsLinked: 9,
          ingestedAt: '2025-11-02T10:08:00Z',
        },
        {
          id: 'pp-4',
          name: 'Telemetrie — Authorized Service Portal',
          kind: 'api',
          sizeLabel: '—',
          status: 'linked',
          fieldsLinked: 6,
          ingestedAt: '2026-01-12T06:00:00Z',
        },
        {
          id: 'pp-5',
          name: 'Werksfoto_Montagelinie_Koeln.jpg',
          kind: 'jpg',
          sizeLabel: '4,1 MB',
          status: 'extracted',
          fieldsLinked: 2,
          ingestedAt: '2025-11-03T15:20:00Z',
        },
      ],
    },
  ];
}
