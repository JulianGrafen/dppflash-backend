import type { EsprProductData } from '@/app/types/espr';
import { isRagProvenanceEnvelope } from '@/app/domain/rag/mergeRagAuditIntoPassport';

export const DEFAULT_MANUFACTURER_PHONE = 'Tel.: +49 211 797 0';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function pickFirstStringFromRecord(
  rec: Record<string, unknown> | undefined,
  keys: readonly string[],
): string | undefined {
  if (!rec) {
    return undefined;
  }
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return undefined;
}

function provenanceContextSnippet(envelopeValue: unknown): string | undefined {
  if (!isRagProvenanceEnvelope(envelopeValue)) {
    return undefined;
  }
  const snippet = String((envelopeValue as Record<string, unknown>).contextSnippet ?? '').trim();
  return snippet.length > 0 ? snippet : undefined;
}

function scoreManufacturerChunkRichness(text: string): number {
  let score = text.trim().length;
  if (/[@+]|\btel\b|telefon|fax|e-mail|https?:\/\//i.test(text)) {
    score += 500;
  }
  if (text.includes('\n')) {
    score += 200;
  }
  return score;
}

function pickBestManufacturerChunk(candidates: readonly string[]): string | undefined {
  const unique = [...new Set(candidates.map((c) => c.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return undefined;
  }
  return unique.sort((a, b) => scoreManufacturerChunkRichness(b) - scoreManufacturerChunkRichness(a))[0];
}

function pickManufacturerDocumentChunk(raw: Record<string, unknown>): string | undefined {
  const candidates: string[] = [];

  const push = (value: unknown) => {
    const snippet = provenanceContextSnippet(value);
    if (snippet) {
      candidates.push(snippet);
    }
    if (isRagProvenanceEnvelope(value)) {
      const inner = (value as Record<string, unknown>).value;
      if (typeof inner === 'string' && inner.trim()) {
        candidates.push(inner.trim());
      }
    } else if (typeof value === 'string' && value.trim()) {
      candidates.push(value.trim());
    }
  };

  push(raw.hersteller);
  push(raw.manufacturer);
  push(raw.Hersteller);

  const enrichment = raw.ragEnrichment;
  const enrichmentRecord =
    typeof enrichment === 'object' && enrichment !== null && !Array.isArray(enrichment)
      ? (enrichment as Record<string, unknown>)
      : undefined;
  if (
    enrichmentRecord
    && 'auditTrail' in enrichmentRecord
    && enrichmentRecord.success === true
  ) {
    const auditTrail = enrichmentRecord.auditTrail;
    if (auditTrail && typeof auditTrail === 'object' && !Array.isArray(auditTrail)) {
      const trailRec = auditTrail as Record<string, unknown>;
      const fields =
        trailRec.fields && typeof trailRec.fields === 'object' && trailRec.fields !== null
          ? (trailRec.fields as Record<string, unknown>)
          : undefined;

      const keysToTry = [
        'hersteller',
        'manufacturer',
        'herstellerName',
        'herstellername',
        'Manufacturer',
      ] as const;
      for (const key of keysToTry) {
        const audited = fields?.[key];
        if (!audited || typeof audited !== 'object' || audited === null) {
          continue;
        }
        const auditedRec = audited as Record<string, unknown>;
        const src = auditedRec.source;
        if (src && typeof src === 'object' && !Array.isArray(src)) {
          const snippetRaw = (src as Record<string, unknown>).contextSnippet;
          const sn = typeof snippetRaw === 'string' ? snippetRaw.trim() : '';
          if (sn.length > 0) {
            candidates.push(sn);
          }
        }
        const auditedValue = auditedRec.value;
        if (typeof auditedValue === 'string' && auditedValue.trim()) {
          candidates.push(auditedValue.trim());
        }
      }
    }
  }

  return pickBestManufacturerChunk(candidates);
}

function splitInlineManufacturerContacts(text: string): string[] {
  return text
    .split(
      /\s+(?=(?:Tel\.?|Telefon|Telefax|Fax|E-Mail|E-mail|e-mail|Mail:|Email:|Internet:|Notruf:|www\.|https?:\/\/))/gi,
    )
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function isOrphanHouseNumberLine(line: string): boolean {
  return /^\d+[a-zA-Z0-9/-]*$/.test(line.trim());
}

function isCompanyLegalSuffixContinuation(previousLine: string, currentLine: string): boolean {
  const prev = previousLine.trim();
  const curr = currentLine.trim();
  if (!prev || !curr) {
    return false;
  }

  // Keep legal company suffixes on the same line, e.g. "Henkel AG & Co." + "KGaA".
  if (/[&\s]co\.$/i.test(prev) && /^(?:kgaa|kg|gmbh|ag|mbh)\b/i.test(curr)) {
    return true;
  }
  if (/\b(?:ag|gmbh)\.$/i.test(prev) && /^(?:kgaa|kg|mbh)\b/i.test(curr)) {
    return true;
  }
  return false;
}

function isContactLine(line: string): boolean {
  return /^(?:tel\.?|telefon|telefax|fax|e-mail|email|mail:|internet:|notruf:|www\.|https?:\/\/|\+?\d)/i.test(line.trim());
}

function phoneDigitCount(line: string): string {
  return line.replace(/\D/g, '');
}

function phoneDigitLength(line: string): number {
  return phoneDigitCount(line).length;
}

function isHenkelCentralPhone(text: string): boolean {
  const digits = phoneDigitCount(text);
  return /^(?:49211797|0211797)/.test(digits) || /211[\s./-]*797/.test(text);
}

function isPhoneContactLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || /^fax:/i.test(trimmed)) {
    return false;
  }
  if (/^(?:tel\.?|telefon):/i.test(trimmed)) {
    return true;
  }
  if (isHenkelCentralPhone(trimmed)) {
    return true;
  }
  const digits = phoneDigitLength(trimmed);
  return digits >= 8 && /^\+?\d/.test(trimmed.replace(/\s/g, ''));
}

export function manufacturerTextIncludesPhone(text: string): boolean {
  if (text.split('\n').some((line) => isPhoneContactLine(line))) {
    return true;
  }
  const digits = phoneDigitCount(text);
  return /^(?:49211797|0211797)/.test(digits);
}

function formatTelDisplay(phone: string | undefined): string | undefined {
  if (!phone?.trim()) {
    return undefined;
  }
  const stripped = phone.trim().replace(/^(?:tel\.?|telefon):\s*/i, '').trim();
  if (isHenkelCentralPhone(stripped)) {
    return DEFAULT_MANUFACTURER_PHONE;
  }
  if (/^(?:tel\.?|fax):/i.test(phone.trim())) {
    return phone.trim();
  }
  return `Tel.: ${stripped}`;
}

function normalizeManufacturerPhoneLine(line: string): string {
  return formatTelDisplay(line) ?? line;
}

function coalesceManufacturerPhoneLines(displayText: string): string {
  const lines = displayText.split('\n').map((line) => line.trim()).filter(Boolean);
  const result: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const telPrefixed = /^(?:tel\.?|telefon):/i.test(line);
    const barePhoneLead = /^\+?\d/.test(line) && phoneDigitLength(line) >= 6;

    if (!telPrefixed && !barePhoneLead) {
      result.push(line);
      continue;
    }

    let merged = line;
    while (index + 1 < lines.length) {
      const next = lines[index + 1];
      if (/^(?:tel\.?|telefon|telefax|fax|e-mail|email|mail:|internet:|notruf:|www\.|https?:)/i.test(next)) {
        break;
      }
      if (/^[\d\s().+\-/]+$/.test(next) && phoneDigitLength(next) <= 6) {
        merged = `${merged} ${next}`;
        index += 1;
        continue;
      }
      break;
    }

    result.push(telPrefixed ? merged : (formatTelDisplay(merged) ?? merged));
  }

  return result.join('\n');
}

function dedupeManufacturerPhoneLines(displayText: string): string {
  const lines = displayText.split('\n').map((line) => line.trim()).filter(Boolean);
  let bestPhoneIndex = -1;
  let bestPhoneDigits = 0;

  for (let index = 0; index < lines.length; index += 1) {
    if (!isPhoneContactLine(lines[index])) {
      continue;
    }
    const digits = phoneDigitLength(lines[index]);
    if (digits > bestPhoneDigits) {
      bestPhoneDigits = digits;
      bestPhoneIndex = index;
    }
  }

  if (bestPhoneIndex === -1) {
    return lines.join('\n');
  }

  const result: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (isPhoneContactLine(lines[index]) && index !== bestPhoneIndex) {
      continue;
    }
    if (index === bestPhoneIndex) {
      result.push(normalizeManufacturerPhoneLine(lines[index]));
      continue;
    }
    result.push(lines[index]);
  }

  return result.join('\n');
}

function normalizeManufacturerLineBreaks(lines: readonly string[]): string[] {
  const normalized: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (normalized.length > 0 && isCompanyLegalSuffixContinuation(normalized[normalized.length - 1], trimmed)) {
      normalized[normalized.length - 1] = `${normalized[normalized.length - 1]} ${trimmed}`;
      continue;
    }

    if (isOrphanHouseNumberLine(trimmed) && normalized.length > 0) {
      const previous = normalized[normalized.length - 1];
      if (isPhoneContactLine(previous) || /^\+?\d/.test(previous)) {
        normalized[normalized.length - 1] = `${previous} ${trimmed}`;
        continue;
      }
      normalized[normalized.length - 1] = `${previous} ${trimmed}`;
      continue;
    }

    normalized.push(trimmed);
  }

  return normalized;
}

function splitCompanyAndStreetLine(beforePlz: string): { readonly company: string; readonly streetLine: string } | null {
  const patterns = [
    /^(.*\S)\s+((?:[A-Za-zäöüÄÖÜß][\wäöüÄÖÜß.\-/]*\s+)+[A-Za-zäöüÄÖÜß][\wäöüÄÖÜß.\-/]*\s+\d+[a-zA-Z0-9/-]*)$/,
    /^(.*\S)\s+([A-Za-zäöüÄÖÜß][\wäöüÄÖÜß.\-/]*\s+\d+[a-zA-Z0-9/-]*)$/,
  ];

  for (const pattern of patterns) {
    const match = beforePlz.match(pattern);
    if (match?.[1] && match[2]) {
      return {
        company: match[1].trim(),
        streetLine: match[2].trim(),
      };
    }
  }

  return null;
}

function formatFlatManufacturerBlock(text: string): string {
  const t = text.trim();
  if (!t || t.includes('\n')) {
    return t;
  }

  const plzTail = t.match(/^(.+?)\s+(\d{5})\s+(.+)$/);
  if (!plzTail?.[1] || !plzTail[2] || !plzTail[3]) {
    return t;
  }

  const beforePlz = plzTail[1].trim();
  const plz = plzTail[2];
  const afterPlz = plzTail[3].trim();

  const streetSplit = splitCompanyAndStreetLine(beforePlz);
  const countryMatch = afterPlz.match(
    /^(.+?)\s+(Deutschland|Germany|Österreich|Austria|Schweiz|Switzerland|France|Frankreich|Italy|Italien|Spain|Spanien|Nederland|Netherlands|België|Belgium|Polska|Poland)$/i,
  );

  if (streetSplit) {
    const blockLines = [streetSplit.company, streetSplit.streetLine];
    if (countryMatch?.[1] && countryMatch[2]) {
      blockLines.push(`${plz} ${countryMatch[1].trim()}`, countryMatch[2]);
    } else {
      blockLines.push(`${plz} ${afterPlz}`);
    }
    return blockLines.join('\n');
  }

  if (countryMatch?.[1] && countryMatch[2]) {
    return [beforePlz, `${plz} ${countryMatch[1].trim()}`, countryMatch[2]].join('\n');
  }

  return [beforePlz, `${plz} ${afterPlz}`].join('\n');
}

function polishManufacturerDisplayText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }

  const lines = normalizeManufacturerLineBreaks(
    trimmed.split(/\n+/).map((line) => line.trim()).filter(Boolean),
  );

  const polished = lines.flatMap((line) => {
    if (isContactLine(line) || line.includes('\n')) {
      return [line];
    }
    if (/\d{5}/.test(line) && !line.includes('\n')) {
      const formatted = formatFlatManufacturerBlock(line);
      return formatted.split('\n').map((entry) => entry.trim()).filter(Boolean);
    }
    return [line];
  });

  return normalizeManufacturerLineBreaks(polished).join('\n');
}

function formatManufacturerDocumentChunk(text: string): string {
  const normalized = text.trim().replace(/\r\n/g, '\n');
  if (!normalized) {
    return normalized;
  }
  if (normalized.includes('\n')) {
    return polishManufacturerDisplayText(
      normalized
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n'),
    );
  }

  const segments = splitInlineManufacturerContacts(normalized);
  if (segments.length <= 1) {
    return formatFlatManufacturerBlock(normalized);
  }

  const [head, ...contacts] = segments;
  const formattedHead = head ? formatFlatManufacturerBlock(head) : '';
  return polishManufacturerDisplayText([formattedHead, ...contacts].filter(Boolean).join('\n'));
}

function normalizeManufacturerCompareLine(line: string): string {
  return line.trim().toLowerCase().replace(/\s+/g, '');
}

function dedupeManufacturerLines(displayText: string): string {
  const lines = displayText.split('\n').map((line) => line.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const line of lines) {
    const normalized = normalizeManufacturerCompareLine(line);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(line);
  }

  return out
    .filter((line, index) => {
      if (isContactLine(line)) {
        return true;
      }
      const norm = normalizeManufacturerCompareLine(line);
      return !out.some((other, otherIndex) => {
        if (otherIndex === index || isContactLine(other)) {
          return false;
        }
        const otherNorm = normalizeManufacturerCompareLine(other);
        return otherNorm.length > norm.length && otherNorm.includes(norm);
      });
    })
    .join('\n');
}

function extractManufacturerContactLines(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && isContactLine(line))
    .join('\n');
}

function mergeManufacturerDisplayTexts(primary: string, secondary: string): string {
  if (!secondary.trim()) {
    return primary;
  }
  if (!primary.trim()) {
    return secondary;
  }

  const primaryNorm = primary
    .split('\n')
    .map(normalizeManufacturerCompareLine)
    .filter(Boolean);
  const primaryBlob = primaryNorm.join('|');

  const extras = secondary
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) {
        return false;
      }
      if (isPhoneContactLine(line) && manufacturerTextIncludesPhone(primary)) {
        return false;
      }
      const norm = normalizeManufacturerCompareLine(line);
      if (!norm || primaryNorm.includes(norm)) {
        return false;
      }
      return !primaryBlob.includes(norm);
    });

  if (extras.length === 0) {
    return primary;
  }
  return [primary, ...extras].join('\n');
}

function appendStructuredManufacturerContacts(
  displayText: string,
  raw: Record<string, unknown>,
  manufacturerView: EsprProductData['manufacturer'],
): string {
  const rec = asRecord(raw.manufacturer);
  const contactLines: string[] = [];

  const tel = formatTelDisplay(
    manufacturerView.phone
    ?? pickFirstStringFromRecord(rec, [
      'phone',
      'telephone',
      'tel',
      'Telefon',
      'telefon',
      'phoneNumber',
    ])
    ?? pickFirstStringFromRecord(raw, ['telefon', 'Telefon', 'phone', 'manufacturerPhone']),
  );
  if (tel && !manufacturerTextIncludesPhone(displayText)) {
    contactLines.push(tel);
  }

  const fax = pickFirstStringFromRecord(rec, ['fax', 'Fax', 'Telefax']);
  if (fax && !/^(?:fax|telefax):/i.test(fax)) {
    contactLines.push(`Fax: ${fax}`);
  } else if (fax) {
    contactLines.push(fax);
  }

  const email =
    manufacturerView.email?.trim()
    ?? pickFirstStringFromRecord(rec, [
      'email',
      'eMail',
      'mail',
      'e-mail',
      'E-Mail',
      'contactEmail',
      'kontaktEmail',
    ])
    ?? pickFirstStringFromRecord(raw, ['email', 'E-Mail', 'eMail']);
  if (email) {
    contactLines.push(email);
  }

  const website =
    manufacturerView.website?.trim()
    ?? pickFirstStringFromRecord(rec, ['website', 'url', 'web', 'homepage', 'Homepage', 'internet']);
  if (website) {
    contactLines.push(website);
  }

  if (contactLines.length === 0) {
    return displayText;
  }

  return mergeManufacturerDisplayTexts(displayText, contactLines.join('\n'));
}

/** Gleiche Zentrale/Henkel-Nummer wie `DEFAULT_MANUFACTURER_PHONE` — unabhängig von Schreibweise. */
function lineMatchesDefaultManufacturerPhone(line: string): boolean {
  if (normalizeManufacturerCompareLine(line) === normalizeManufacturerCompareLine(DEFAULT_MANUFACTURER_PHONE)) {
    return true;
  }
  return isHenkelCentralPhone(line);
}

/**
 * Fügt die feste Servicenummer immer ein (vor Fax/E-Mail/Web), sobald noch keine
 * passende Zeile im Text steht — ohne die frühere „telefon‑irgendwas“‑Heuristik.
 */
function ensureDefaultManufacturerPhone(displayText: string): string {
  const trimmed = displayText.trim();
  if (!trimmed) {
    return DEFAULT_MANUFACTURER_PHONE;
  }

  const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.some(lineMatchesDefaultManufacturerPhone)) {
    return lines.join('\n');
  }

  const firstContactIndex = lines.findIndex((line) => isContactLine(line));
  const insertAt = firstContactIndex === -1 ? lines.length : firstContactIndex;
  const next = [...lines];
  next.splice(insertAt, 0, DEFAULT_MANUFACTURER_PHONE);
  return next.join('\n');
}

function formatManufacturerRichText(
  raw: Record<string, unknown>,
  manufacturerView: EsprProductData['manufacturer'],
): string {
  const rec = asRecord(raw.manufacturer);

  const preformatted = pickFirstStringFromRecord(rec, [
    'contactBlock',
    'contactDetails',
    'fullContact',
    'herstellerBlock',
    'herstellerAngaben',
    'kontakt',
  ]);
  if (preformatted) {
    return formatFlatManufacturerBlock(preformatted);
  }

  const phoneFromRec = pickFirstStringFromRecord(rec, [
    'phone',
    'telephone',
    'tel',
    'Telefon',
    'telefon',
    'phoneNumber',
    'fax',
    'Fax',
    'Telefax',
  ]);

  const emailFromRec = pickFirstStringFromRecord(rec, [
    'email',
    'eMail',
    'mail',
    'e-mail',
    'E-Mail',
    'contactEmail',
    'kontaktEmail',
    'serviceEmail',
  ]);

  const websiteFromRec = pickFirstStringFromRecord(rec, [
    'website',
    'url',
    'web',
    'homepage',
    'Homepage',
    'internet',
  ]);

  const lines: string[] = [];

  const name =
    manufacturerView.name?.trim()
    || pickFirstStringFromRecord(rec, ['name', 'company', 'firma'])
    || '';
  if (name) {
    lines.push(name);
  }
  if (manufacturerView.address?.trim()) {
    lines.push(manufacturerView.address.trim());
  }
  if (manufacturerView.country?.trim()) {
    lines.push(manufacturerView.country.trim());
  }

  const tel = formatTelDisplay(manufacturerView.phone ?? phoneFromRec);
  if (tel) {
    lines.push(tel);
  }

  const email = manufacturerView.email?.trim() ?? emailFromRec;
  if (email) {
    lines.push(email);
  }

  const website = manufacturerView.website?.trim() ?? websiteFromRec;
  if (website) {
    lines.push(website);
  }

  if (manufacturerView.eoriNumber?.trim()) {
    lines.push(`EORI: ${manufacturerView.eoriNumber.trim()}`);
  }

  const structured = lines.join('\n').trim();
  const flatHersteller = typeof raw.hersteller === 'string' ? raw.hersteller.trim() : '';

  if (flatHersteller) {
    const structPackedLen = structured.replace(/\s/g, '').length;
    const flatSignalsContact = /[@+]|\btel\b|https?:\/\//i.test(flatHersteller);
    const structSignalsContact =
      /@|\btel\b|\+?\d[\d\s().-]{8,}|https?:\/\//i.test(structured.replace(/Tel\.:\s*/gi, ''));

    if (
      flatSignalsContact
      && (flatHersteller.length > structured.length + 14 || structPackedLen < 16)
      && (!structSignalsContact || flatHersteller.length > structured.length + 28)
    ) {
      return formatFlatManufacturerBlock(flatHersteller);
    }
  }

  if (structured) {
    return formatFlatManufacturerBlock(structured);
  }
  return formatFlatManufacturerBlock(flatHersteller);
}

/** Priorisiert den vollständigen Dokument-Chunk (Abschnitt 1) inkl. Tel./E-Mail. */
export function resolveManufacturerPublication(
  raw: Record<string, unknown>,
  p: EsprProductData,
): { readonly displayText: string } {
  const chunk = pickManufacturerDocumentChunk(raw)?.trim();
  const synthesized =
    formatManufacturerRichText(raw, p.manufacturer).trim()
    || p.manufacturer.name.trim()
    || (typeof raw.hersteller === 'string' ? raw.hersteller.trim() : '');

  const fromChunk = chunk ? formatManufacturerDocumentChunk(chunk) : '';
  const fromSynth = synthesized ? formatManufacturerDocumentChunk(synthesized) : '';

  const merged = fromChunk
    ? mergeManufacturerDisplayTexts(fromChunk, extractManufacturerContactLines(fromSynth))
    : fromSynth;

  const withoutDefault = dedupeManufacturerLines(
    dedupeManufacturerPhoneLines(
      coalesceManufacturerPhoneLines(
        polishManufacturerDisplayText(
          appendStructuredManufacturerContacts(merged, raw, p.manufacturer),
        ),
      ),
    ),
  );

  return {
    displayText: ensureDefaultManufacturerPhone(withoutDefault),
  };
}
