import { describe, expect, it, vi } from 'vitest';
import { FridaTapRuntime } from './index.js';
import type { FridaMessage, FridaScript, FridaSession, TapReadEvent } from './index.js';

function createFakeScript(options: { failLoad?: boolean } = {}): {
  script: FridaScript;
  posted: unknown[];
  deliver: (message: FridaMessage, data: Buffer | null) => void;
  loadCalls: number;
  unloadCalls: number;
} {
  const posted: unknown[] = [];
  let handler: ((message: FridaMessage, data: Buffer | null) => void) | null = null;
  let loadCalls = 0;
  let unloadCalls = 0;

  const script: FridaScript = {
    message: {
      connect: (h) => {
        handler = h;
      },
    },
    load: () => {
      loadCalls += 1;
      return options.failLoad ? Promise.reject(new Error('script load failed')) : Promise.resolve();
    },
    unload: () => {
      unloadCalls += 1;
      return Promise.resolve();
    },
    post: (message) => {
      posted.push(message);
    },
  };

  return {
    script,
    posted,
    deliver: (message, data) => handler?.(message, data),
    get loadCalls() {
      return loadCalls;
    },
    get unloadCalls() {
      return unloadCalls;
    },
  };
}

function createFakeSession(script: FridaScript, options: { failCreateScript?: boolean } = {}): {
  session: FridaSession;
  detachCalls: number;
} {
  let detachCalls = 0;
  const session: FridaSession = {
    createScript: () =>
      options.failCreateScript ? Promise.reject(new Error('createScript failed')) : Promise.resolve(script),
    detach: () => {
      detachCalls += 1;
      return Promise.resolve();
    },
  };
  return {
    session,
    get detachCalls() {
      return detachCalls;
    },
  };
}

describe('FridaTapRuntime.attach', () => {
  it('loads the script and returns a session carrying the pid', async () => {
    const { script } = createFakeScript();
    const { session } = createFakeSession(script);
    const runtime = new FridaTapRuntime({ attach: () => Promise.resolve(session) });

    const tapSession = await runtime.attach(4242);

    expect(tapSession.pid).toBe(4242);
  });

  it('detaches the session when createScript rejects', async () => {
    const { script } = createFakeScript();
    const fakeSession = createFakeSession(script, { failCreateScript: true });
    const runtime = new FridaTapRuntime({ attach: () => Promise.resolve(fakeSession.session) });

    await expect(runtime.attach(1)).rejects.toThrow('createScript failed');
    expect(fakeSession.detachCalls).toBe(1);
  });

  it('unloads the script and detaches the session when script.load() rejects', async () => {
    const fakeScript = createFakeScript({ failLoad: true });
    const fakeSession = createFakeSession(fakeScript.script);
    const runtime = new FridaTapRuntime({ attach: () => Promise.resolve(fakeSession.session) });

    await expect(runtime.attach(1)).rejects.toThrow('script load failed');
    expect(fakeScript.unloadCalls).toBe(1);
    expect(fakeSession.detachCalls).toBe(1);
  });
});

describe('FridaTapSession.installInterceptor', () => {
  it('posts an install message and dispatches a matching read message to the registered listener', async () => {
    const fake = createFakeScript();
    const { session } = createFakeSession(fake.script);
    const runtime = new FridaTapRuntime({ attach: () => Promise.resolve(session) });
    const tapSession = await runtime.attach(1);

    const interceptor = tapSession.installInterceptor(0x1000);
    expect(fake.posted).toContainEqual({ type: 'install', address: 0x1000 });

    const received: TapReadEvent[] = [];
    interceptor.onRead((event) => received.push(event));

    fake.deliver({ type: 'send', payload: { type: 'read', address: 0x1000, ctx: 'conn-1' } }, Buffer.from([1, 2, 3]));

    expect(received).toEqual([{ ctx: 'conn-1', bytes: new Uint8Array([1, 2, 3]) }]);
  });

  it('ignores a read message for an address with no registered listener', async () => {
    const fake = createFakeScript();
    const { session } = createFakeSession(fake.script);
    const runtime = new FridaTapRuntime({ attach: () => Promise.resolve(session) });
    const tapSession = await runtime.attach(1);
    tapSession.installInterceptor(0x1000);

    expect(() => {
      fake.deliver({ type: 'send', payload: { type: 'read', address: 0x2000, ctx: 'conn-2' } }, Buffer.from([9]));
    }).not.toThrow();
  });

  it('ignores a non-send message and a send message with a malformed payload', async () => {
    const fake = createFakeScript();
    const { session } = createFakeSession(fake.script);
    const runtime = new FridaTapRuntime({ attach: () => Promise.resolve(session) });
    const tapSession = await runtime.attach(1);
    const interceptor = tapSession.installInterceptor(0x1000);
    const received: TapReadEvent[] = [];
    interceptor.onRead((event) => received.push(event));

    fake.deliver({ type: 'error', payload: { type: 'read', address: 0x1000, ctx: 'x' } }, Buffer.from([1]));
    fake.deliver({ type: 'send', payload: { type: 'not-a-read' } }, Buffer.from([1]));
    fake.deliver({ type: 'send', payload: { type: 'read', address: 0x1000, ctx: 'x' } }, null);

    expect(received).toEqual([]);
  });
});

describe('FridaTapRuntime script message handling', () => {
  it('logs an error message from the injected script instead of swallowing it', async () => {
    const fake = createFakeScript();
    const { session } = createFakeSession(fake.script);
    const log = { info: vi.fn() };
    const runtime = new FridaTapRuntime({ attach: () => Promise.resolve(session), log });
    await runtime.attach(7);

    fake.deliver(
      { type: 'error', description: 'ReferenceError: foo is not defined', stack: 'at agent.js:1:1' },
      null,
    );

    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'tap-runtime',
        event: 'script.error',
        pid: 7,
        description: 'ReferenceError: foo is not defined',
        stack: 'at agent.js:1:1',
      }),
    );
  });

  it('does not throw and does not tear the session down when the script reports an error', async () => {
    const fake = createFakeScript();
    const { session } = createFakeSession(fake.script);
    const runtime = new FridaTapRuntime({ attach: () => Promise.resolve(session) });
    await runtime.attach(1);

    expect(() => {
      fake.deliver({ type: 'error', description: 'boom' }, null);
    }).not.toThrow();
    expect(fake.unloadCalls).toBe(0);
  });
});

describe('TapInterceptor.detach', () => {
  it('posts a detach message and stops delivering to the removed listener', async () => {
    const fake = createFakeScript();
    const { session } = createFakeSession(fake.script);
    const runtime = new FridaTapRuntime({ attach: () => Promise.resolve(session) });
    const tapSession = await runtime.attach(1);
    const interceptor = tapSession.installInterceptor(0x1000);
    const received: TapReadEvent[] = [];
    interceptor.onRead((event) => received.push(event));

    interceptor.detach();
    expect(fake.posted).toContainEqual({ type: 'detach', address: 0x1000 });

    fake.deliver({ type: 'send', payload: { type: 'read', address: 0x1000, ctx: 'x' } }, Buffer.from([1]));
    expect(received).toEqual([]);
  });

  it('is idempotent — a second detach posts nothing further', async () => {
    const fake = createFakeScript();
    const { session } = createFakeSession(fake.script);
    const runtime = new FridaTapRuntime({ attach: () => Promise.resolve(session) });
    const tapSession = await runtime.attach(1);
    const interceptor = tapSession.installInterceptor(0x1000);

    interceptor.detach();
    const postedAfterFirst = fake.posted.length;
    interceptor.detach();

    expect(fake.posted).toHaveLength(postedAfterFirst);
  });
});

describe('TapSession.detach', () => {
  it('resolves only once the script unload and the underlying session detach have both settled', async () => {
    const fake = createFakeScript();
    let resolveUnload: (() => void) | undefined;
    fake.script.unload = () => new Promise((resolve) => { resolveUnload = resolve; });

    const fakeSession = createFakeSession(fake.script);
    let resolveSessionDetach: (() => void) | undefined;
    let sessionDetachCalls = 0;
    fakeSession.session.detach = () => {
      sessionDetachCalls += 1;
      return new Promise((resolve) => { resolveSessionDetach = resolve; });
    };

    const runtime = new FridaTapRuntime({ attach: () => Promise.resolve(fakeSession.session) });
    const tapSession = await runtime.attach(1);

    let settled = false;
    const detachPromise = tapSession.detach().then(() => {
      settled = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(sessionDetachCalls).toBe(0);

    resolveUnload?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(sessionDetachCalls).toBe(1);

    resolveSessionDetach?.();
    await detachPromise;
    expect(settled).toBe(true);
  });

  it('is idempotent — an already-detached session resolves without repeating the teardown', async () => {
    const fake = createFakeScript();
    const fakeSession = createFakeSession(fake.script);
    const runtime = new FridaTapRuntime({ attach: () => Promise.resolve(fakeSession.session) });
    const tapSession = await runtime.attach(1);

    await tapSession.detach();
    await tapSession.detach();

    expect(fakeSession.detachCalls).toBe(1);
    expect(fake.unloadCalls).toBe(1);
  });

  it('resolves rather than rejects, and logs the failure, when the underlying session detach rejects', async () => {
    const fake = createFakeScript();
    const { session } = createFakeSession(fake.script);
    session.detach = () => Promise.reject(new Error('detach failed'));
    const log = { info: vi.fn() };
    const runtime = new FridaTapRuntime({ attach: () => Promise.resolve(session), log });
    const tapSession = await runtime.attach(1);

    await expect(tapSession.detach()).resolves.toBeUndefined();

    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'tap-runtime', event: 'session.session_detach_failed', pid: 1 }),
    );
  });

  it('resolves rather than rejects, and still detaches the session, when script.unload() rejects', async () => {
    const fake = createFakeScript();
    fake.script.unload = () => Promise.reject(new Error('unload failed'));
    const fakeSession = createFakeSession(fake.script);
    const log = { info: vi.fn() };
    const runtime = new FridaTapRuntime({ attach: () => Promise.resolve(fakeSession.session), log });
    const tapSession = await runtime.attach(1);

    await expect(tapSession.detach()).resolves.toBeUndefined();

    expect(fakeSession.detachCalls).toBe(1);
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'tap-runtime', event: 'session.script_unload_failed', pid: 1 }),
    );
  });
});
