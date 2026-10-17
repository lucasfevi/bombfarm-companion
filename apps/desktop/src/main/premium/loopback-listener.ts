import { timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import { LOOPBACK_PAGE } from './loopback-page.js';

export type LoopbackResult =
  | { kind: 'code'; code: string }
  | { kind: 'declined' }
  | { kind: 'timed-out' }
  | { kind: 'closed' };

export interface LoopbackListener {
  readonly redirectUri: string;
  readonly result: Promise<LoopbackResult>;
  close(): void;
}

export interface LoopbackListenerOptions {
  readonly expectedState: string;
  readonly timeoutMs: number;
  readonly createServer?: typeof http.createServer;
  readonly scheduler?: { readonly setTimeout: typeof setTimeout; readonly clearTimeout: typeof clearTimeout };
}

const CALLBACK_PATH = '/callback';
const LOOPBACK_ADDRESS = '127.0.0.1';

const COMMON_HEADERS = {
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  connection: 'close',
} as const;

function sameState(received: string | null, expected: string): boolean {
  if (received === null) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function refuse(res: http.ServerResponse, status: 400 | 404): void {
  res.writeHead(status, COMMON_HEADERS);
  res.end();
}

export function startLoopbackListener(opts: LoopbackListenerOptions): Promise<LoopbackListener> {
  const setTimeoutFn = opts.scheduler?.setTimeout ?? setTimeout;
  const clearTimeoutFn = opts.scheduler?.clearTimeout ?? clearTimeout;
  const createServer = opts.createServer ?? http.createServer;

  return new Promise((resolveStart, rejectStart) => {
    let port = 0;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let resolveResult: (result: LoopbackResult) => void = () => undefined;
    const result = new Promise<LoopbackResult>((resolve) => {
      resolveResult = resolve;
    });

    const server = createServer((req, res) => {
      if (settled) {
        refuse(res, 404);
        return;
      }
      let url: URL;
      try {
        url = new URL(req.url ?? '', `http://${LOOPBACK_ADDRESS}`);
      } catch {
        refuse(res, 404);
        return;
      }
      if (req.method !== 'GET' || url.pathname !== CALLBACK_PATH) {
        refuse(res, 404);
        return;
      }
      if (req.headers.host !== `${LOOPBACK_ADDRESS}:${String(port)}`) {
        refuse(res, 400);
        return;
      }
      if (!sameState(url.searchParams.get('state'), opts.expectedState)) {
        refuse(res, 400);
        return;
      }
      const declined = url.searchParams.has('error');
      const code = url.searchParams.get('code');
      if (!declined && (code === null || code === '')) {
        refuse(res, 400);
        return;
      }
      res.writeHead(200, { ...COMMON_HEADERS, 'content-type': 'text/html; charset=utf-8' });
      res.end(LOOPBACK_PAGE);
      finish(declined || code === null ? { kind: 'declined' } : { kind: 'code', code });
    });

    function finish(outcome: LoopbackResult): void {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeoutFn(timer);
      server.close();
      resolveResult(outcome);
    }

    server.once('error', rejectStart);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', rejectStart);
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close();
        rejectStart(new Error('listener has no port'));
        return;
      }
      port = address.port;
      timer = setTimeoutFn(() => {
        finish({ kind: 'timed-out' });
      }, opts.timeoutMs);
      resolveStart({
        redirectUri: `http://${LOOPBACK_ADDRESS}:${String(port)}${CALLBACK_PATH}`,
        result,
        close: () => {
          finish({ kind: 'closed' });
        },
      });
    });
  });
}
