import type { PassportFieldDefinition } from './passportFieldCatalog';
import type { EditorPassportLocale } from './passportFieldI18n';
import { passportFieldNote } from './passportFieldI18n';

const NORMATIVE_LEAD = /^(?:DIN\b|Annex\s+XIII|Art\.?\s*\d)/i;

/** Citation-only lines such as "DIN 6.1.2.4 / Art 38(7)." */
function isNormativeCitationOnly(note: string): boolean {
  const trimmed = note.trim();
  if (!trimmed) {
    return true;
  }
  if (!NORMATIVE_LEAD.test(trimmed)) {
    return false;
  }
  // No explanatory clause after an em dash.
  if (/\s[—–]\s/.test(trimmed)) {
    return false;
  }
  return /^DIN\s+[\d./\s]+(?:\/\s*Art\.?\s*[\d()]+)*(?:\/\s*Annex\s+XIII[^.]*)?\.?$/i.test(trimmed)
    || /^DIN\s+[\d.]+\.?$/i.test(trimmed)
    || /^Art\.?\s*[\d()]+[^.]*\.?$/i.test(trimmed);
}

/**
 * Field notes for the dashboard editor: hide pure DIN/Art citations, keep human-readable hints.
 */
export function passportFieldEditorNote(
  def: PassportFieldDefinition,
  locale: EditorPassportLocale,
): string {
  const raw = passportFieldNote(def, locale).trim();
  if (!raw) {
    return '';
  }

  const dashParts = raw.split(/\s+[—–]\s+/);
  if (dashParts.length >= 2 && NORMATIVE_LEAD.test(dashParts[0])) {
    return dashParts.slice(1).join(' — ').trim();
  }

  if (isNormativeCitationOnly(raw)) {
    return '';
  }

  return raw;
}
