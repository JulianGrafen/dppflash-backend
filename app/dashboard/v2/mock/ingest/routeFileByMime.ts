import type { FileIngestRoute } from './types';

export function routeFileByMime(fileName: string, mime?: string): FileIngestRoute {
  const lower = fileName.toLowerCase();
  const type = (mime ?? '').toLowerCase();

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
    return 'spreadsheet';
  }
  if (lower.endsWith('.json') || type.includes('json')) {
    return 'json';
  }
  if (lower.endsWith('.pdf') || lower.endsWith('.docx') || lower.endsWith('.doc')) {
    return 'document';
  }
  if (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp') ||
    type.startsWith('image/')
  ) {
    return 'image';
  }
  return 'unsupported';
}
