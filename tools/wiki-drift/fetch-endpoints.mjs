// The only network-touching module. Both the network call (`fetchImpl`) and the delay
// between retries (`sleep`) are parameters, so no test in this repo ever waits or dials out.
//
// Stage order matters (see check.mjs): this module answers only "did the two endpoints answer
// with a JSON object" — never "did they answer with the RIGHT object". A request failure, a
// timeout, or a 200 carrying anything other than a JSON object all resolve here, before any
// comparison against a baseline is even attempted.

export const DATA_URL = 'https://wiki.bombfarm.net/wiki/api/data';
export const FASES_NOMES_URL = 'https://wiki.bombfarm.net/wiki/api/fases-nomes';

const BACKOFF_MS = [1000, 4000];

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function fetchOnce(url, fetchImpl, timeoutMs) {
  let response;
  try {
    response = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const isTimeout = err != null && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return { ok: false, reason: isTimeout ? 'timeout' : 'network-error' };
  }

  if (!response.ok) {
    return { ok: false, reason: `http-${response.status}` };
  }

  let body;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }

  if (!isPlainObject(body)) {
    return { ok: false, reason: 'unexpected-top-level-type' };
  }

  return { ok: true, payload: body };
}

async function fetchWithRetry(url, { fetchImpl, sleep, attempts, timeoutMs }) {
  let lastReason = 'unknown';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await fetchOnce(url, fetchImpl, timeoutMs);
    if (result.ok) return result;
    lastReason = result.reason;
    if (attempt < attempts) {
      const delayMs = BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
      await sleep(delayMs);
    }
  }
  return { ok: false, reason: lastReason };
}

/**
 * Fetches `/wiki/api/data` then `/wiki/api/fases-nomes`, each with bounded retry.
 *
 * @param {{ fetchImpl: typeof fetch, sleep: (ms: number) => Promise<void>, attempts?: number, timeoutMs?: number }} args
 * @returns {Promise<{ ok: true, payloads: { data: object, fasesNomes: object } } | { ok: false, reason: string, url: string, attempts: number }>}
 */
export async function fetchEndpoints({ fetchImpl, sleep, attempts = 3, timeoutMs = 15_000 }) {
  const dataResult = await fetchWithRetry(DATA_URL, { fetchImpl, sleep, attempts, timeoutMs });
  if (!dataResult.ok) {
    return { ok: false, reason: dataResult.reason, url: DATA_URL, attempts };
  }

  const fasesNomesResult = await fetchWithRetry(FASES_NOMES_URL, {
    fetchImpl,
    sleep,
    attempts,
    timeoutMs,
  });
  if (!fasesNomesResult.ok) {
    return { ok: false, reason: fasesNomesResult.reason, url: FASES_NOMES_URL, attempts };
  }

  return {
    ok: true,
    payloads: { data: dataResult.payload, fasesNomes: fasesNomesResult.payload },
  };
}
