import process from 'node:process';

import { readEtlServiceBaseUrl, readEtlServiceHeaders } from '@/app/lib/etl/etlServiceUrl';

export type EtlFetchResult = {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
};

function isNextDeploymentMisroute(responseText: string): boolean {
  return (
    responseText.includes('Failed to find Server Action') ||
    responseText.includes('__NEXT_DATA__') ||
    responseText.includes('<!DOCTYPE html')
  );
}

export async function fetchEtl(
  path: string,
  init: RequestInit = {},
): Promise<EtlFetchResult> {
  const baseUrl = readEtlServiceBaseUrl();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(readEtlServiceHeaders())) {
    headers.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `ETL nicht erreichbar unter ${url}. ` +
        'Prüfe ETL_SERVICE_URL (muss dppflash-etl.onrender.com sein, nicht das Backend). ' +
        message,
      { cause: error },
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  const responseText = await response.text();

  if (contentType.includes('application/json')) {
    try {
      const body = JSON.parse(responseText) as Record<string, unknown>;
      return { ok: response.ok, status: response.status, body };
    } catch {
      // fall through to generic invalid response
    }
  }

  if (isNextDeploymentMisroute(responseText)) {
    throw new Error(
      `ETL_SERVICE_URL zeigt vermutlich auf das Next.js-Backend (${baseUrl}), nicht auf dppflash-etl. ` +
        'Setze in Render → dppflash-backend → Environment: ETL_SERVICE_URL=https://dppflash-etl.onrender.com',
    );
  }

  const preview = responseText.replace(/\s+/g, ' ').slice(0, 180);
  throw new Error(
    `Ungültige ETL-Antwort von ${url} (HTTP ${response.status}, ${contentType || 'no content-type'}): ${preview}`,
  );
}

export function readEtlDiagnostics(): Record<string, unknown> {
  const configured =
    process.env.ETL_SERVICE_URL?.trim() || process.env.ETL_REMOTE_URL?.trim() || null;
  const ownUrl = process.env.RENDER_EXTERNAL_URL?.trim() || null;
  const pointsToSelf =
    Boolean(configured && ownUrl) &&
    configured!.replace(/\/$/, '') === ownUrl.replace(/\/$/, '');

  return {
    etl_service_url: configured,
    render_external_url: ownUrl,
    points_to_self: pointsToSelf,
    secret_configured: Boolean(process.env.ETL_SERVICE_SECRET?.trim()),
  };
}
