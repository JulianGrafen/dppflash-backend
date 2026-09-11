import process from 'node:process';

function isHostedProduction(): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return false;
  }
  return (
    Boolean(process.env.RENDER?.trim() || process.env.RENDER_SERVICE_ID?.trim()) ||
    Boolean(process.env.VERCEL?.trim() || process.env.VERCEL_ENV?.trim())
  );
}

function assertNotSelfEtlUrl(url: string): void {
  const ownUrl = process.env.RENDER_EXTERNAL_URL?.trim();
  if (!ownUrl) {
    return;
  }
  if (url.replace(/\/$/, '') === ownUrl.replace(/\/$/, '')) {
    throw new Error(
      'ETL_SERVICE_URL zeigt auf dieses Backend — muss die URL von dppflash-etl sein ' +
        '(z. B. https://dppflash-etl.onrender.com).',
    );
  }
}

/** Normalize Render private host:port or public https URL. */
export function normalizeEtlServiceUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, '');
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

/** Base URL for the Python ETL FastAPI service (local fallback for dev only). */
export function readEtlServiceBaseUrl(): string {
  const configured =
    process.env.ETL_SERVICE_URL?.trim() || process.env.ETL_REMOTE_URL?.trim();
  if (configured) {
    const url = normalizeEtlServiceUrl(configured);
    assertNotSelfEtlUrl(url);
    return url;
  }
  if (isHostedProduction()) {
    const host = process.env.VERCEL ? 'Vercel' : 'Render';
    throw new Error(
      `ETL_SERVICE_URL fehlt (${host}). Setze ` +
        'ETL_SERVICE_URL=https://dppflash-etl.onrender.com ' +
        'und ETL_SERVICE_SECRET (gleicher Wert wie beim ETL-Service auf Render).',
    );
  }
  return 'http://127.0.0.1:8000';
}

export function readEtlServiceHeaders(): Record<string, string> {
  const secret = process.env.ETL_SERVICE_SECRET?.trim();
  if (!secret) {
    return {};
  }
  return { Authorization: `Bearer ${secret}` };
}
