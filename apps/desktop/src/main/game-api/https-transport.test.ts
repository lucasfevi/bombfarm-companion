import { EventEmitter } from 'node:events';
import http from 'node:http';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_RESPONSE_BYTES, ResponseTooLargeError } from '@bombfarm/game-api';
import { companionUserAgent, createNodeHttpsTransport, withUserAgent } from './https-transport.js';

/** Replays `chunks` as the socket's response through the real `data`/`end` handlers. */
function respondWith(chunks: readonly Buffer[]): void {
  vi.spyOn(https, 'request').mockImplementation(((_options: unknown, onResponse: (response: EventEmitter) => void) => {
    const response = Object.assign(new EventEmitter(), { statusCode: 200, destroy: () => undefined });
    return Object.assign(new EventEmitter(), {
      destroy: () => undefined,
      end: () => {
        onResponse(response);
        for (const chunk of chunks) response.emit('data', chunk);
        response.emit('end');
      },
    });
  }) as never);
}

const GET = { host: 'app.bombfarm.net', method: 'GET', path: '/inventory', headers: {}, timeoutMs: 15_000 } as const;

describe('createNodeHttpsTransport — reading the body', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps a multibyte character that straddles two chunks whole', async () => {
    const body = Buffer.from('{"name":"Coração"}');
    const split = body.indexOf(0xc3) + 1;
    respondWith([body.subarray(0, split), body.subarray(split)]);
    await expect(createNodeHttpsTransport('UA/1')(GET)).resolves.toEqual({ status: 200, body: '{"name":"Coração"}' });
  });

  it('reads a body the size of a 20,000-row inventory', async () => {
    const body = Buffer.alloc(6_000_000, 0x20);
    respondWith([body]);
    const response = await createNodeHttpsTransport('UA/1')(GET);
    expect(response.body.length).toBe(6_000_000);
  });

  it('stops at the shared limit and names the failure, rather than reading as a network error', async () => {
    respondWith([Buffer.alloc(MAX_RESPONSE_BYTES), Buffer.alloc(1)]);
    const failure = await createNodeHttpsTransport('UA/1')(GET).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ResponseTooLargeError);
    expect((failure as ResponseTooLargeError).bytes).toBe(MAX_RESPONSE_BYTES + 1);
  });

  it('gives up on a body that keeps trickling, which the silence timeout never catches', async () => {
    const server = http.createServer((_request, response) => {
      response.writeHead(200);
      const trickle = setInterval(() => response.write(' '), 20);
      response.on('close', () => {
        clearInterval(trickle);
      });
    });
    await new Promise<void>((listening) => server.listen(0, '127.0.0.1', listening));
    const { port } = server.address() as AddressInfo;
    vi.spyOn(https, 'request').mockImplementation(((options: http.RequestOptions, onResponse: (r: http.IncomingMessage) => void) =>
      http.request({ ...options, host: '127.0.0.1', port }, onResponse)) as never);

    const failure = await createNodeHttpsTransport('UA/1', 200)({ ...GET, timeoutMs: 5_000 }).catch((error: unknown) => error);

    server.closeAllConnections();
    server.close();
    expect(failure).toEqual(new Error('request deadline exceeded'));
  });
});

describe('companionUserAgent', () => {
  it('names the product and the running version', () => {
    expect(companionUserAgent('0.14.0')).toBe('Bomb Farm Companion/0.14.0');
  });

  it('carries whatever version the app reports, so a release is distinguishable on the wire', () => {
    expect(companionUserAgent('1.2.3')).toBe('Bomb Farm Companion/1.2.3');
  });
});

describe('withUserAgent — what the socket actually sends', () => {
  const built = {
    Authorization: 'Bearer token',
    Accept: 'application/json',
    Host: 'app.bombfarm.net',
    Connection: 'close',
  } as const;

  it('adds the identity beside every header the request already carries, changing none of them', () => {
    expect(withUserAgent(built, 'UA/1')).toEqual({ ...built, 'User-Agent': 'UA/1' });
  });

  it('the account path is never anonymous — node:https sends no user-agent of its own', () => {
    expect(withUserAgent(built, 'UA/1')['User-Agent']).toBe('UA/1');
  });

  it('does not mutate the headers it was given', () => {
    const headers = { ...built };
    withUserAgent(headers, 'UA/1');
    expect(headers).toEqual(built);
  });
});
