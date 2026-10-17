import http from 'node:http';
import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { LOOPBACK_PAGE } from './loopback-page.js';
import { startLoopbackListener, type LoopbackListener } from './loopback-listener.js';

const STATE = 'state-value-for-tests';

interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function send(target: string, init: { method?: string; host?: string } = {}): Promise<Reply> {
  const url = new URL(target);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: init.method ?? 'GET',
        agent: false,
        headers: init.host === undefined ? {} : { host: init.host },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function connectOnce(uri: string): Promise<'refused' | 'connected'> {
  const url = new URL(uri);
  return new Promise((resolve) => {
    const socket = net.connect({ host: url.hostname, port: Number(url.port) });
    socket.once('connect', () => {
      socket.destroy();
      resolve('connected');
    });
    socket.once('error', () => {
      resolve('refused');
    });
  });
}

type Scheduler = NonNullable<Parameters<typeof startLoopbackListener>[0]['scheduler']>;

const open: LoopbackListener[] = [];

async function start(timeoutMs = 60_000, scheduler?: Scheduler): Promise<LoopbackListener> {
  const listener = await startLoopbackListener({
    expectedState: STATE,
    timeoutMs,
    ...(scheduler === undefined ? {} : { scheduler }),
  });
  open.push(listener);
  return listener;
}

afterEach(() => {
  for (const listener of open.splice(0)) listener.close();
});

describe('startLoopbackListener', () => {
  it('binds the loopback address on an OS-assigned port and names it in the redirect', async () => {
    const listener = await start();
    expect(listener.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
    expect(new URL(listener.redirectUri).port).not.toBe('0');
  });

  it('answers the first valid callback once with the page and closes', async () => {
    const listener = await start();
    const reply = await send(`${listener.redirectUri}?code=abc&state=${STATE}`);

    expect(reply.status).toBe(200);
    expect(reply.headers['cache-control']).toBe('no-store');
    expect(reply.headers['referrer-policy']).toBe('no-referrer');
    expect(reply.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(reply.body).toBe(LOOPBACK_PAGE);
    await expect(listener.result).resolves.toEqual({ kind: 'code', code: 'abc' });
    expect(await connectOnce(listener.redirectUri)).toBe('refused');
  });

  it('finds nothing listening for a second valid callback', async () => {
    const listener = await start();
    await send(`${listener.redirectUri}?code=abc&state=${STATE}`);
    await expect(send(`${listener.redirectUri}?code=again&state=${STATE}`)).rejects.toThrow();
  });

  it('resolves declined on an error callback and closes', async () => {
    const listener = await start();
    const reply = await send(`${listener.redirectUri}?error=access_denied&state=${STATE}`);

    expect(reply.status).toBe(200);
    await expect(listener.result).resolves.toEqual({ kind: 'declined' });
    expect(await connectOnce(listener.redirectUri)).toBe('refused');
  });

  it('refuses an error callback that carries the wrong state and keeps waiting', async () => {
    const listener = await start();
    const reply = await send(`${listener.redirectUri}?error=access_denied&state=nope`);
    expect(reply.status).toBe(400);

    const valid = await send(`${listener.redirectUri}?code=abc&state=${STATE}`);
    expect(valid.status).toBe(200);
    await expect(listener.result).resolves.toEqual({ kind: 'code', code: 'abc' });
  });

  describe('refusals never consume the attempt', () => {
    interface Case {
      name: string;
      status: number;
      target: (base: string) => string;
      method?: string;
      host?: string;
    }
    const cases: Case[] = [
      { name: 'a wrong path', status: 404, target: (b) => `${b.replace('/callback', '/other')}?code=abc&state=${STATE}` },
      { name: 'the root path', status: 404, target: (b) => `${b.replace('/callback', '/')}?code=abc&state=${STATE}` },
      { name: 'a POST', status: 404, method: 'POST', target: (b) => `${b}?code=abc&state=${STATE}` },
      { name: 'a wrong state', status: 400, target: (b) => `${b}?code=abc&state=wrong` },
      { name: 'a state of another length', status: 400, target: (b) => `${b}?code=abc&state=${STATE}x` },
      { name: 'a missing state', status: 400, target: (b) => `${b}?code=abc` },
      { name: 'an empty code', status: 400, target: (b) => `${b}?code=&state=${STATE}` },
      { name: 'a missing code', status: 400, target: (b) => `${b}?state=${STATE}` },
      { name: 'a wrong Host', status: 400, target: (b) => `${b}?code=abc&state=${STATE}`, host: 'localhost:1' },
      {
        name: 'the right address on the wrong port in Host',
        status: 400,
        target: (b) => `${b}?code=abc&state=${STATE}`,
        host: '127.0.0.1:1',
      },
    ];

    it.each(cases)('answers $status for $name and still accepts the valid callback', async (entry) => {
      const listener = await start();
      const refused = await send(entry.target(listener.redirectUri), {
        ...(entry.method === undefined ? {} : { method: entry.method }),
        ...(entry.host === undefined ? {} : { host: entry.host }),
      });
      expect(refused.status).toBe(entry.status);
      expect(refused.body).not.toContain(STATE);

      const valid = await send(`${listener.redirectUri}?code=real&state=${STATE}`);
      expect(valid.status).toBe(200);
      await expect(listener.result).resolves.toEqual({ kind: 'code', code: 'real' });
    });
  });

  it('times out on the fake clock and closes', async () => {
    const callbacks: (() => void)[] = [];
    const delays: number[] = [];
    const listener = await start(300_000, {
      setTimeout: ((callback: () => void, delay: number) => {
        callbacks.push(callback);
        delays.push(delay);
        return callbacks.length as unknown as ReturnType<typeof setTimeout>;
      }) as unknown as typeof setTimeout,
      clearTimeout: (() => undefined) as unknown as typeof clearTimeout,
    });

    expect(delays).toEqual([300_000]);
    callbacks[0]?.();

    await expect(listener.result).resolves.toEqual({ kind: 'timed-out' });
    expect(await connectOnce(listener.redirectUri)).toBe('refused');
  });

  it('clears its timer when a callback arrives first', async () => {
    const cleared: unknown[] = [];
    const listener = await start(300_000, {
      setTimeout: (() => 7 as unknown as ReturnType<typeof setTimeout>) as unknown as typeof setTimeout,
      clearTimeout: ((handle: unknown) => {
        cleared.push(handle);
      }) as unknown as typeof clearTimeout,
    });
    await send(`${listener.redirectUri}?code=abc&state=${STATE}`);
    expect(cleared).toEqual([7]);
  });

  it('resolves closed on close() at once, and closing twice is safe', async () => {
    const listener = await start();
    listener.close();
    listener.close();

    await expect(listener.result).resolves.toEqual({ kind: 'closed' });
    expect(await connectOnce(listener.redirectUri)).toBe('refused');
  });

  it('keeps the first outcome when closed after a callback', async () => {
    const listener = await start();
    await send(`${listener.redirectUri}?code=abc&state=${STATE}`);
    listener.close();
    await expect(listener.result).resolves.toEqual({ kind: 'code', code: 'abc' });
  });

  it('rejects when the server cannot bind', async () => {
    const failing = (() => {
      const server = http.createServer();
      server.listen = () => {
        queueMicrotask(() => server.emit('error', new Error('EADDRINUSE')));
        return server;
      };
      return server;
    }) as unknown as typeof http.createServer;

    await expect(
      startLoopbackListener({ expectedState: STATE, timeoutMs: 1000, createServer: failing }),
    ).rejects.toThrow('EADDRINUSE');
  });
});
