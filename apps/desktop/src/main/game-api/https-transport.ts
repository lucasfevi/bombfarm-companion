import https from 'node:https';
import type { HttpResponse, HttpTransport } from '@bombfarm/game-api';
export { companionUserAgent } from '@bombfarm/game-api';

/**
 * The only socket (apps/desktop's syscall boundary). Converts an `HttpRequest` into an `HttpResponse` or
 * throws — `request.ts` (packages/game-api) classifies whatever comes back or gets thrown.
 * No retry, no IP fallback, no response classification. A byte cap is enforced while streaming so
 * an oversized body is never buffered whole (belt-and-suspenders alongside `request.ts`'s own
 * `MAX_RESPONSE_BYTES` check on the already-collected string).
 *
 * The one header built here rather than in `request.ts` is `User-Agent`, and it is here precisely
 * because it names the running application build: `request.ts` owns the string's shape
 * (`companionUserAgent`, re-exported above) but derives its headers from the session, and cannot
 * know the app's version without threading it through five signatures.
 * `node:https` sends no user-agent of its own, so without this the account path is anonymous on
 * the wire — the only choice with nothing to recommend it, since it leaves the server operator no
 * way to tell this tool apart from anything else.
 */
const MAX_RESPONSE_BYTES = 2_000_000;

/** Exported so the merge is directly testable: the request's own headers win nothing back, and
 *  every built header survives alongside the identity this transport adds. */
export function withUserAgent(
  headers: Readonly<Record<string, string>>,
  userAgent: string,
): Record<string, string> {
  return { ...headers, 'User-Agent': userAgent };
}

export function createNodeHttpsTransport(userAgent: string): HttpTransport {
  return (req) => sendOverHttps(req, userAgent);
}

const sendOverHttps = (req: Parameters<HttpTransport>[0], userAgent: string): Promise<HttpResponse> =>
  new Promise<HttpResponse>((resolve, reject) => {
    const request = https.request(
      {
        host: req.host,
        method: req.method,
        path: req.path,
        headers: withUserAgent(req.headers, userAgent),
        timeout: req.timeoutMs,
      },
      (response) => {
        let body = '';
        let bytes = 0;
        let capExceeded = false;

        response.on('data', (chunk: Buffer) => {
          if (capExceeded) return;
          bytes += chunk.length;
          if (bytes > MAX_RESPONSE_BYTES) {
            capExceeded = true;
            response.destroy();
            reject(new Error(`response exceeded ${String(MAX_RESPONSE_BYTES)} bytes while streaming`));
            return;
          }
          body += chunk.toString('utf8');
        });

        response.on('end', () => {
          if (capExceeded) return;
          resolve({ status: response.statusCode ?? 0, body });
        });

        response.on('error', (err) => {
          if (capExceeded) return;
          reject(err instanceof Error ? err : new Error(String(err)));
        });
      },
    );

    request.on('timeout', () => {
      request.destroy(new Error('request timed out'));
    });

    request.on('error', (err) => {
      reject(err instanceof Error ? err : new Error(String(err)));
    });

    if (req.signal) {
      if (req.signal.aborted) {
        request.destroy(new Error('aborted'));
      } else {
        req.signal.addEventListener('abort', () => request.destroy(new Error('aborted')), { once: true });
      }
    }

    request.end();
  });
