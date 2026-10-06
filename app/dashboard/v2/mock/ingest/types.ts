import type { PassportFieldSourceAttribution, PassportFieldValueState } from '../types';

export type IngestSourceKind = 'sap_mock' | 'pim_mock' | 'file';

export type IngestFieldPatch = {
  value: string;
  confidence: number;
  provenance?: PassportFieldValueState['provenance'];
  source?: PassportFieldSourceAttribution;
};

export type IngestPatchMap = Record<string, IngestFieldPatch>;

export type FileIngestRoute =
  | 'spreadsheet'
  | 'json'
  | 'document'
  | 'image'
  | 'unsupported';

export const DEMO_FOLDER_FILE_LIMIT = 100;
