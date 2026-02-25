/**
 * 自動リトライ付きfetch
 * 500/502/503/504 エラー時に指数バックオフで再試行
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let lastError: Error | null = null;
  let delay = 500;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || attempt === maxAttempts || !isRetryable(res.status)) {
        return res;
      }
      // リトライ対象のステータスコード → 待って再試行
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxAttempts) throw lastError;
    }
    await new Promise((r) => setTimeout(r, delay));
    delay *= 2;
  }

  throw lastError ?? new Error('fetchWithRetry: unexpected');
}

function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/** JSON レスポンスを返すショートカット */
export async function fetchJsonWithRetry<T>(
  url: string,
  options?: RequestInit,
  maxAttempts = 3,
): Promise<T> {
  const res = await fetchWithRetry(url, options, maxAttempts);
  return res.json() as Promise<T>;
}
