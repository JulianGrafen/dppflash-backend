/** Canonical legal pages on the DPP-Flash marketing site. */
export const DPPFLASH_MARKETING_ORIGIN = 'https://dppflash.de';

export const dppflashLegalUrls = {
  impressum: `${DPPFLASH_MARKETING_ORIGIN}/impressum`,
  datenschutz: `${DPPFLASH_MARKETING_ORIGIN}/datenschutz`,
  agb: `${DPPFLASH_MARKETING_ORIGIN}/agb`,
} as const;

export type DppflashLegalSlug = keyof typeof dppflashLegalUrls;

export const dppflashLegalLabels: Record<DppflashLegalSlug, string> = {
  impressum: 'Impressum',
  datenschutz: 'Datenschutzerklärung',
  agb: 'AGB',
};
