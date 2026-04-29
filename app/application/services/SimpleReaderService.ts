const JINA_PROXY_BASE_URL = 'https://r.jina.ai/';
const USER_AGENT = 'dppf-backend-simple-reader/1.0';
const REQUEST_TIMEOUT_MS = 15_000;

export class SimpleReaderService {
  static async readUrl(url: string): Promise<string> {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      throw new Error('URL is required.');
    }

    const encodedTargetUrl = encodeURI(trimmedUrl);
    const proxyUrl = `${JINA_PROXY_BASE_URL}${encodedTargetUrl}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/markdown,text/plain;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403 || response.status === 451) {
          throw new Error(`Access blocked by target page or proxy (HTTP ${response.status}).`);
        }

        throw new Error(`Simple reader request failed with status ${response.status}.`);
      }

      return await response.text();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Simple reader request timed out after ${REQUEST_TIMEOUT_MS}ms.`);
      }

      if (error instanceof Error) {
        throw new Error(`Simple reader failed: ${error.message}`);
      }

      throw new Error('Simple reader failed due to an unknown error.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
