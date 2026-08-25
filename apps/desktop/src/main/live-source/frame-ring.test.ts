import { describe, expect, it } from 'vitest';
import { FrameRing, PERSONAL_FIELDS, type FrameDumpWritePort, type FrameRingDeps, type LogPort } from './frame-ring.js';

function jsonFrame(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value), 'utf8');
}

function createWriteSpy(): { writePort: FrameDumpWritePort; writes: Array<{ destination: string; contents: string }> } {
  const writes: Array<{ destination: string; contents: string }> = [];
  return {
    writePort: {
      write: (destination, contents) => {
        writes.push({ destination, contents });
      },
    },
    writes,
  };
}

function createLogSpy(): { log: LogPort; warnings: Record<string, unknown>[] } {
  const warnings: Record<string, unknown>[] = [];
  return { log: { info: () => undefined, warn: (record) => warnings.push(record) }, warnings };
}

class FakeClock {
  #now = 0;

  now = (): number => this.#now;

  advance(ms: number): void {
    this.#now += ms;
  }
}

function createRing(overrides: Partial<FrameRingDeps> = {}) {
  const { writePort, writes } = createWriteSpy();
  const { log, warnings } = createLogSpy();
  const clock = new FakeClock();
  const ring = new FrameRing({
    maxFrames: 5,
    maxBytes: 500,
    dumpPath: 'ring-dump.json',
    writePort,
    now: clock.now,
    log,
    ...overrides,
  });
  return { ring, writes, warnings, clock };
}

describe('FrameRing: eviction bounds', () => {
  it('holds only the newest frames within both the frame-count and byte-size caps, in arrival order', () => {
    const { ring } = createRing({ maxFrames: 3, maxBytes: 10_000 });
    for (let i = 0; i < 5; i += 1) {
      ring.push(jsonFrame({ t: 'snap', index: i }));
    }

    expect(ring.size()).toBe(3);
    const dump = JSON.parse(ring.dump()) as { frames: Array<{ payload: { index: number } }> };
    expect(dump.frames.map((f) => f.payload.index)).toEqual([2, 3, 4]);
  });

  it('evicts oldest-first once the byte cap is reached before the frame-count cap', () => {
    const { ring } = createRing({ maxFrames: 100, maxBytes: 60 });
    const frames = [jsonFrame({ i: 0, pad: 'aaaaaaaaaa' }), jsonFrame({ i: 1, pad: 'aaaaaaaaaa' }), jsonFrame({ i: 2, pad: 'aaaaaaaaaa' })];
    for (const frame of frames) ring.push(frame);

    expect(ring.size()).toBeLessThan(frames.length);
    const dump = JSON.parse(ring.dump()) as { frames: Array<{ payload: { i: number } }> };
    expect(dump.frames[dump.frames.length - 1]?.payload.i).toBe(2);
  });

  it('drops a single frame larger than the byte cap instead of evicting everything to admit it', () => {
    const { ring } = createRing({ maxFrames: 10, maxBytes: 50 });
    ring.push(jsonFrame({ kept: true }));
    const oversized = Buffer.alloc(200, 0x61);
    ring.push(oversized);

    expect(ring.size()).toBe(1);
    const dump = JSON.parse(ring.dump()) as { frames: Array<{ payload: { kept: boolean } }> };
    expect(dump.frames[0]?.payload.kept).toBe(true);
  });
});

describe('FrameRing: dump scrubbing', () => {
  it('removes a registered secret, account_id, and player_name from the serialised dump', () => {
    const { ring } = createRing();
    ring.registerSecret('sekret-token-value');
    ring.push(jsonFrame({ t: 'snap', account: { account_id: 'acct-1', player_name: 'Lucas' }, session: 'sekret-token-value' }));

    const dump = ring.dump();

    expect(dump).not.toContain('acct-1');
    expect(dump).not.toContain('Lucas');
    expect(dump).not.toContain('sekret-token-value');
    for (const field of PERSONAL_FIELDS) {
      expect(dump).not.toContain(field);
    }
  });

  it('scrubs a registered secret found as a raw substring in a frame that does not parse as JSON', () => {
    const { ring } = createRing();
    ring.registerSecret('sekret-token-value');
    ring.push(Buffer.from('not-json sekret-token-value trailing garbage', 'utf8'));

    expect(ring.dump()).not.toContain('sekret-token-value');
  });

  it('strips a token via the single-slot credential redactor, in both a JSON frame and a text frame', () => {
    const { ring } = createRing();
    const rawToken = 'sTkn-live-frame-9f8e7d6c5b4a3210';
    ring.setCredentialRedactor((text) => text.split(rawToken).join('[redacted]'));

    ring.push(jsonFrame({ t: 'snap', session: rawToken }));
    ring.push(Buffer.from(`not-json ${rawToken} trailing garbage`, 'utf8'));

    expect(ring.dump()).not.toContain(rawToken);
  });

  it('replacing the credential redactor with a later call drops the earlier one', () => {
    const { ring } = createRing();
    const firstToken = 'sTkn-first-token-value';
    const secondToken = 'sTkn-second-token-value';
    ring.setCredentialRedactor((text) => text.split(firstToken).join('[redacted]'));
    ring.setCredentialRedactor((text) => text.split(secondToken).join('[redacted]'));

    ring.push(Buffer.from(`session ${secondToken}`, 'utf8'));

    expect(ring.dump()).not.toContain(secondToken);
  });

  it('redacts a payload key named token by name, even though its value was never registered as a secret', () => {
    const { ring } = createRing();
    ring.push(jsonFrame({ t: 'snap', token: 'unregistered-token-raw-value' }));

    const dump = ring.dump();

    expect(dump).not.toContain('unregistered-token-raw-value');
    const parsed = JSON.parse(dump) as { frames: Array<{ payload: { token: string } }> };
    expect(parsed.frames[0]?.payload.token).toBe('[redacted]');
  });

  it('redacts a payload key named cookie by name, even though its value was never registered as a secret', () => {
    const { ring } = createRing();
    ring.push(jsonFrame({ t: 'snap', cookie: 'unregistered-cookie-raw-value' }));

    const dump = ring.dump();

    expect(dump).not.toContain('unregistered-cookie-raw-value');
    const parsed = JSON.parse(dump) as { frames: Array<{ payload: { cookie: string } }> };
    expect(parsed.frames[0]?.payload.cookie).toBe('[redacted]');
  });

  it('replaces a frame that cannot be interpreted as text at all with a redacted placeholder', () => {
    const { ring } = createRing();
    const binary = Buffer.from([0xff, 0xfe, 0x00, 0x80, 0x81, 0x00, 0xc3, 0x28]);
    ring.push(binary);

    const dump = JSON.parse(ring.dump()) as { frames: Array<{ kind: string }> };
    expect(dump.frames[0]?.kind).toBe('unreadable');
  });

  it('dumps an empty artifact rather than throwing when the ring holds no frames', () => {
    const { ring } = createRing();
    expect(() => ring.dump()).not.toThrow();
    expect(JSON.parse(ring.dump())).toEqual({ frameCount: 0, frames: [] });
  });
});

describe('FrameRing: disk dumping', () => {
  it('is triggerable both by a parse-failure reason and an explicit manual reason, on the same terms', () => {
    const { ring, writes, clock } = createRing();
    ring.push(jsonFrame({ t: 'snap' }));

    ring.dumpToDisk('parse-failure');
    expect(writes).toHaveLength(1);

    clock.advance(10_000);
    ring.dumpToDisk('manual');
    expect(writes).toHaveLength(2);
  });

  it('reports a successful write as written: true, carrying the destination path', () => {
    const { ring } = createRing({ dumpPath: 'ring-dump.json' });
    ring.push(jsonFrame({ t: 'snap' }));

    expect(ring.dumpToDisk('manual')).toEqual({ written: true, path: 'ring-dump.json' });
  });

  it('rate-limits two dumps in quick succession to a single write', () => {
    const { ring, writes, clock } = createRing({ dumpRateLimitMs: 1_000 });
    ring.push(jsonFrame({ t: 'snap' }));

    ring.dumpToDisk('parse-failure');
    clock.advance(10);
    ring.dumpToDisk('parse-failure');

    expect(writes).toHaveLength(1);
  });

  it('reports a rate-limited call as written: false rather than as a silent success', () => {
    const { ring, clock } = createRing({ dumpRateLimitMs: 1_000 });
    ring.push(jsonFrame({ t: 'snap' }));

    ring.dumpToDisk('parse-failure');
    clock.advance(10);

    expect(ring.dumpToDisk('manual')).toEqual({ written: false, reason: 'rate-limited' });
  });

  it('does not throw and keeps accepting frames when the write destination is unwritable', () => {
    const { log, warnings } = createLogSpy();
    const ring = new FrameRing({
      maxFrames: 5,
      maxBytes: 500,
      dumpPath: 'unwritable.json',
      writePort: {
        write: () => {
          throw new Error('ENOSPC: no space left on device');
        },
      },
      log,
    });
    ring.push(jsonFrame({ t: 'snap' }));

    expect(() => {
      ring.dumpToDisk('parse-failure');
    }).not.toThrow();
    expect(warnings).toHaveLength(1);

    ring.push(jsonFrame({ t: 'snap', second: true }));
    expect(ring.size()).toBe(2);
  });

  it('reports a failed write as written: false rather than as a silent success', () => {
    const ring = new FrameRing({
      maxFrames: 5,
      maxBytes: 500,
      dumpPath: 'unwritable.json',
      writePort: {
        write: () => {
          throw new Error('ENOSPC: no space left on device');
        },
      },
    });
    ring.push(jsonFrame({ t: 'snap' }));

    expect(ring.dumpToDisk('manual')).toEqual({ written: false, reason: 'write-failed' });
  });

  it('writes an empty artifact to disk for an empty ring rather than erroring', () => {
    const { ring, writes } = createRing();
    ring.dumpToDisk('manual');

    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0]?.contents ?? '')).toEqual({ frameCount: 0, frames: [] });
  });
});
