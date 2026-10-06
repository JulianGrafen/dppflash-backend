import type { LucideIcon } from 'lucide-react';
import { Database, ShoppingBag, Store, Zap } from 'lucide-react';

export type IntegrationId = 'akeneo' | 'xentral' | 'shopify' | 'zapier';

export type IntegrationDefinition = {
  id: IntegrationId;
  name: string;
  description: string;
  icon: LucideIcon;
  connectedStat: string;
};

export const INTEGRATION_DEFINITIONS: readonly IntegrationDefinition[] = [
  {
    id: 'akeneo',
    name: 'Akeneo PIM',
    description: 'Product master & attributes',
    icon: Database,
    connectedStat: '4,250 SKUs synced',
  },
  {
    id: 'xentral',
    name: 'Xentral ERP',
    description: 'Orders, stock & BOM',
    icon: Store,
    connectedStat: '4,250 SKUs synced',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Storefront catalog',
    icon: ShoppingBag,
    connectedStat: '1,820 products linked',
  },
  {
    id: 'zapier',
    name: 'Zapier (Custom)',
    description: 'Custom automations',
    icon: Zap,
    connectedStat: 'Custom rules active',
  },
];

export const CATALOG_SUMMARY = {
  totalSkus: 4250,
  fullyCompliant: 3100,
  gapsIdentified: 1150,
} as const;

export type CatalogRow = {
  sku: string;
  name: string;
  source: string;
  completion: number;
  status: string;
};

export const MASTER_CATALOG_ROWS: readonly CatalogRow[] = [
  {
    sku: 'BAT-PRO-27',
    name: 'E-Bike Battery Pro',
    source: 'Akeneo + Magic Inbox',
    completion: 100,
    status: 'Ready for EU Customs',
  },
  {
    sku: 'BAT-LITE-27',
    name: 'E-Bike Battery Lite',
    source: 'Xentral',
    completion: 85,
    status: 'Missing Cobalt Share',
  },
  {
    sku: 'PV-HOME-5K',
    name: 'Home Storage 5kWh',
    source: 'Akeneo',
    completion: 92,
    status: 'Missing UN 38.3 PDF',
  },
  {
    sku: 'TOOL-PACK-18V',
    name: 'Power Tool Pack 18V',
    source: 'Manual CSV Upload',
    completion: 100,
    status: 'Ready for EU Customs',
  },
  {
    sku: 'SCOOT-BAT-V2',
    name: 'E-Scooter Cell V2',
    source: 'Akeneo + Magic Inbox',
    completion: 40,
    status: 'Supplier Outreach Required',
  },
];

export function inboxEmailForDomain(companyDomain: string): string {
  const domain = companyDomain.trim().toLowerCase() || 'yourcompany';
  return `import-data@${domain}.dppflash.com`;
}

export function gapStatusLabels(): string[] {
  return MASTER_CATALOG_ROWS.filter((r) => r.completion < 100).map((r) => r.status);
}
