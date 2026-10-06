import type { FileIngestRoute } from './types';
import type { IngestPatchMap } from './types';

export function buildFileMockPatches(fileName: string, route: FileIngestRoute): IngestPatchMap {
  const baseId = fileName.replace(/[^a-z0-9]+/gi, '-').slice(0, 32);

  if (route === 'spreadsheet') {
    return {
      'durability.capacityFade': {
        value: '4.2',
        confidence: 0.93,
        provenance: 'ai',
        source: {
          kind: 'excel',
          documentTitle: fileName,
          documentId: `file-${baseId}`,
          locationLabel: 'Sheet „Cycle_Results“, Zeile 48',
          contextSnippet: 'Capacity fade after 500 cycles (%): 4.2',
        },
      },
      'durability.powerFade': {
        value: '3.1',
        confidence: 0.92,
        provenance: 'ai',
        source: {
          kind: 'excel',
          documentTitle: fileName,
          documentId: `file-${baseId}`,
          locationLabel: 'Sheet „Cycle_Results“, Zeile 49',
          contextSnippet: 'Power fade after 500 cycles (%): 3.1',
        },
      },
    };
  }

  if (route === 'json') {
    return {
      'compliance.testReports': {
        value: 'IEC 62619 test report bundle (ingested JSON)',
        confidence: 0.91,
        provenance: 'ai',
        source: {
          kind: 'api',
          documentTitle: fileName,
          documentId: `file-${baseId}`,
          locationLabel: 'ERP_WEBHOOK payload',
          contextSnippet: 'testReports reference from staging JSON',
        },
      },
    };
  }

  if (route === 'document') {
    return {
      'conformity.euDeclaration': {
        value: 'EU declaration of conformity per Regulation (EU) 2023/1542',
        confidence: 0.78,
        provenance: 'ai',
        source: {
          kind: 'pdf',
          documentTitle: fileName,
          documentId: `file-${baseId}`,
          locationLabel: 'Seite 1, Konformitätserklärung',
          pageNumber: 1,
          contextSnippet: 'EU declaration of conformity — extracted from uploaded document',
        },
      },
      'carbonFootprint.studyUrl': {
        value: 'https://example.corp/cf-study/voltstride-720',
        confidence: 0.72,
        provenance: 'ai',
        source: {
          kind: 'pdf',
          documentTitle: fileName,
          documentId: `file-${baseId}`,
          locationLabel: 'Seite 2, Fußnote Studien-URL',
          pageNumber: 2,
          contextSnippet: 'Public web link to carbon-footprint study (DIN 6.3.8)',
        },
      },
    };
  }

  if (route === 'image') {
    return {
      'manufacturing.place': {
        value: 'Köln, Deutschland',
        confidence: 0.86,
        provenance: 'ai',
        source: {
          kind: 'image',
          documentTitle: fileName,
          documentId: `file-${baseId}`,
          locationLabel: 'OCR overlay — plant label',
          contextSnippet: 'Manufacturing place: Köln, Deutschland (OCR)',
        },
      },
    };
  }

  return {};
}
