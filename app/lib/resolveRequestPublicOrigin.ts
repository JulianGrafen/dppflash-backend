import type { NextRequest } from 'next/server';

/**
 * Origin of the site as seen by the client (for same-deployment product URLs).
 * Uses `x-forwarded-*` when behind a reverse proxy; otherwise `request.nextUrl.origin`.
 *
 * Intentionally does **not** use `NEXT_PUBLIC_DPP_URL` here, so links from API
 * responses match the host you are actually using (avoids localhost vs. prod env mismatches).
 */
export function resolveRequestPublicOrigin(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (proto && host && /^https?$/i.test(proto)) {
    return `${proto.toLowerCase()}://${host}`;
  }
  return request.nextUrl.origin;
}
