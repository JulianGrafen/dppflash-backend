import process from 'node:process';

/** Base URL for the Python ETL FastAPI service (local fallback for dev). */
export function readEtlServiceBaseUrl(): string {
  const configured =
    process.env.ETL_SERVICE_URL?.trim() || process.env.ETL_REMOTE_URL?.trim();
  return (configured ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
}

export function readEtlServiceHeaders(): Record<string, string> {
  const secret = process.env.ETL_SERVICE_SECRET?.trim();
  if (!secret) {
    return {};
  }
  return { Authorization: `Bearer ${secret}` };
}
