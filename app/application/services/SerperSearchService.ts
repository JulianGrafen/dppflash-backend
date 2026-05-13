import { assertSafePublicHttpUrl } from '@/app/lib/security/safeHttpUrl';

const SERPER_SEARCH_URL = 'https://google.serper.dev/search';
const SERPER_API_KEY_ENV = 'SERPER_API_KEY';
const SEARCH_QUERY_SUFFIX = 'GTIN EAN';
const FINAL_RESULT_LIMIT = 3;
const MAX_PRODUCT_NAME_CHARS = 180;

interface SerperOrganicResult {
  readonly link?: string;
}

interface SerperSearchResponse {
  readonly organic?: readonly SerperOrganicResult[];
}

export class SerperSearchService {
  static async findProductLinks(productName: string): Promise<readonly string[]> {
    const apiKey = process.env[SERPER_API_KEY_ENV];

    if (!apiKey) {
      throw new Error(`${SERPER_API_KEY_ENV} is not configured.`);
    }

    const safeName = productName.trim().slice(0, MAX_PRODUCT_NAME_CHARS);
    const query = `${safeName} ${SEARCH_QUERY_SUFFIX}`.trim();
    const response = await fetch(SERPER_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        q: query,
        num: 10,
      }),
    });

    if (!response.ok) {
      throw new Error(`Serper search failed for query "${query}" with status ${response.status}.`);
    }

    const payload = await response.json() as SerperSearchResponse;
    const links = (payload.organic ?? [])
      .map((entry) => entry.link)
      .filter((link): link is string => typeof link === 'string' && link.length > 0)
      .filter((link) => {
        try {
          assertSafePublicHttpUrl(link);
          return true;
        } catch {
          return false;
        }
      });

    return [...new Set(links)].slice(0, FINAL_RESULT_LIMIT);
  }
}
