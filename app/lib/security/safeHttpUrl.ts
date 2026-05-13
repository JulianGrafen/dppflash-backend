/**
 * SSRF mitigation for server-side HTTP fetches (OWASP A10).
 * Allows only public http(s) URLs; blocks localhost, private/link-local ranges, and metadata endpoints.
 */

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isPrivateOrReservedIpv4(hostname: string): boolean {
  const match = IPV4.exec(hostname);
  if (!match) {
    return false;
  }

  const [a, b] = [Number(match[1]), Number(match[2])];
  if ([a, b, Number(match[3]), Number(match[4])].some((n) => n > 255)) {
    return true;
  }

  if (a === 0 || a === 127) {
    return true;
  }
  if (a === 10) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }

  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();

  if (!h) {
    return true;
  }
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) {
    return true;
  }
  if (h === '[::1]' || h === '::1') {
    return true;
  }
  if (h.startsWith('[') && h.includes('::ffff:127.')) {
    return true;
  }
  if (isPrivateOrReservedIpv4(h)) {
    return true;
  }

  return false;
}

/**
 * Validates URL for outbound fetch from trusted server code. Throws if unsafe.
 */
export function assertSafePublicHttpUrl(urlString: string): URL {
  let url: URL;

  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed.');
  }

  if (url.username || url.password) {
    throw new Error('URLs with credentials are not allowed.');
  }

  if (isBlockedHostname(url.hostname)) {
    throw new Error('Target host is not allowed.');
  }

  return url;
}
