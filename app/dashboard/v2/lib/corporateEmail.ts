const BLOCKED_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'outlook.de',
  'hotmail.com',
  'hotmail.de',
  'live.com',
  'live.de',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'gmx.de',
  'gmx.net',
  'web.de',
  'yahoo.com',
  'yahoo.de',
  'aol.com',
  'mail.com',
  'yandex.com',
  't-online.de',
]);

export type CorporateEmailValidation =
  | { ok: true; email: string; domain: string }
  | { ok: false; message: string };

export function validateCorporateEmail(raw: string): CorporateEmailValidation {
  const email = raw.trim().toLowerCase();
  if (!email) {
    return { ok: false, message: 'Bitte geben Sie Ihre geschäftliche E-Mail-Adresse ein.' };
  }

  const match = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/.exec(email);
  if (!match) {
    return { ok: false, message: 'Ungültiges E-Mail-Format.' };
  }

  const domain = match[1]!;
  if (BLOCKED_EMAIL_DOMAINS.has(domain)) {
    return {
      ok: false,
      message:
        'Freemail-Adressen sind nicht erlaubt. Bitte verwenden Sie Ihre Firmen-Adresse (z. B. name@firma.de).',
    };
  }

  return { ok: true, email, domain };
}
