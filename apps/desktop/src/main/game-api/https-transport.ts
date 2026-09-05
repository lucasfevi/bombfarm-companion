import https from 'node:https';
import type { HttpResponse, HttpTransport } from '@bombfarm/game-api';

/**
 * The only socket (apps/desktop's syscall boundary). Converts an `HttpRequest` into an `HttpResponse` or
 * throws — `request.ts` (packages/game-api) classifies whatever comes back or gets thrown.
 * No header construction (the headers arrive built), no retry, no IP fallback, no response
 * classification. A byte cap is enforced while streaming so an oversized body is never buffered
 * whole (belt-and-suspenders alongside `request.ts`'s own `MAX_RESPONSE_BYTES` check on the
 * already-collected string).
 */
const MAX_RESPONSE_BYTES = 2_000_000;

export const nodeHttpsTransport: HttpTransport = (req): Promise<HttpResponse> =>
  new Promise<HttpResponse>((resolve, reject) => {
    const request = https.request(
      {
        host: req.host,
        method: req.method,
        path: req.path,
        headers: req.headers,
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
