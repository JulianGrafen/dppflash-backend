import process from 'node:process';

function isRenderProduction(): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    Boolean(process.env.RENDER?.trim() || process.env.RENDER_SERVICE_ID?.trim())
  );
}

/** Base URL for the Python ETL FastAPI service (local fallback for dev only). */
export function readEtlServiceBaseUrl(): string {
  const configured =
    process.env.ETL_SERVICE_URL?.trim() || process.env.ETL_REMOTE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  if (isRenderProduction()) {
    throw new Error(
      'ETL_SERVICE_URL fehlt auf Render. In dppflash-backend → Environment setzen: ' +
        'ETL_SERVICE_URL=https://dppflash-etl.onrender.com ' +
        '(und ETL_SERVICE_SECRET identisch zum ETL-Service).',
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
