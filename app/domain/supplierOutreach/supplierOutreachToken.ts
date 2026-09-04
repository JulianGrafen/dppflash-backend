import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export interface SupplierOutreachGap {
  readonly field_path: string;
  readonly reason: string;
  readonly severity: string;
}

export interface SupplierOutreachPayload {
  readonly product_identifier: string | null;
  readonly recipient_email: string;
  readonly supplier_name: string | null;
  readonly gaps: readonly SupplierOutreachGap[];
  readonly issued_at: string;
  readonly expires_at: string;
}

export class SupplierOutreachTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupplierOutreachTokenError';
  }
}

function b64urlDecode(value: string): Buffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(value + padding, 'base64url');
}

function outreachSecret(): string {
  const secret = process.env.SUPPLIER_OUTREACH_SECRET?.trim();
  if (!secret) {
    throw new SupplierOutreachTokenError('SUPPLIER_OUTREACH_SECRET is not configured.');
  }
  return secret;
}

export function hashOutreachToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function verifySupplierOutreachToken(token: string): SupplierOutreachPayload {
  const dotIndex = token.lastIndexOf('.');
  if (dotIndex <= 0) {
    throw new SupplierOutreachTokenError('Malformed outreach token.');
  }

  const body = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  const expected = createHmac('sha256', outreachSecret()).update(body).digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(signature, 'utf8');
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    throw new SupplierOutreachTokenError('Invalid outreach token signature.');
  }

  let payload: SupplierOutreachPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString('utf8')) as SupplierOutreachPayload;
  } catch {
    throw new SupplierOutreachTokenError('Invalid outreach token payload.');
  }

  const expiresAt = Date.parse(payload.expires_at);
  if (Number.isNaN(expiresAt)) {
    throw new SupplierOutreachTokenError('Outreach token expiry is invalid.');
  }
  if (Date.now() > expiresAt) {
    throw new SupplierOutreachTokenError('Outreach token expired.');
  }

  return payload;
}
