import { describe, expect, it } from 'vitest';
import { applyIngestToPassportFields } from '@/app/dashboard/v2/mock/ingest/applyIngestToPassportFields';
import { routeFileByMime } from '@/app/dashboard/v2/mock/ingest/routeFileByMime';
import { initializePassportFieldsFromCatalog } from '@/app/dashboard/v2/mock/passportFields';

describe('applyIngestToPassportFields', () => {
  it('fills empty fields from structured SAP patch', () => {
    const fields = initializePassportFieldsFromCatalog();
    const next = applyIngestToPassportFields(
      fields,
      {
        'battery.uniqueId': { value: 'SKU-1', confidence: 0.97, provenance: 'confirmed' },
      },
      { source: 'sap_mock', structured: true },
    );
    expect(next['battery.uniqueId']?.value).toBe('SKU-1');
    expect(next['battery.uniqueId']?.provenance).toBe('confirmed');
  });

  it('does not let low-confidence AI overwrite high-confidence structured value', () => {
    const fields = initializePassportFieldsFromCatalog();
    fields['battery.uniqueId'] = {
      ...fields['battery.uniqueId'],
      value: 'SAP-99',
      confidence: 0.95,
      provenance: 'confirmed',
    };
    const next = applyIngestToPassportFields(
      fields,
      {
        'battery.uniqueId': { value: 'AI-guess', confidence: 0.7, provenance: 'ai' },
      },
      { source: 'file', structured: false },
    );
    expect(next['battery.uniqueId']?.value).toBe('SAP-99');
  });
});

describe('routeFileByMime', () => {
  it('routes spreadsheets and documents', () => {
    expect(routeFileByMime('bom.xlsx')).toBe('spreadsheet');
    expect(routeFileByMime('study.pdf', 'application/pdf')).toBe('document');
    expect(routeFileByMime('photo.jpg', 'image/jpeg')).toBe('image');
    expect(routeFileByMime('readme.txt')).toBe('unsupported');
  });
});
