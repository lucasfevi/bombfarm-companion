import { describe, expect, it } from 'vitest';
import {
  encodeCaptureHeader,
  encodeCaptureRecord,
  readCaptureRecords,
  type CaptureRecord,
} from './capture-format.js';
import {
  createFrameCapture,
  readFrameCaptureEnabledFromEnv,
  type FrameCaptureAppendPort,
  type FrameCaptureDeps,
  type LogPort,
} from './frame-capture.js';

/** `toEqual` treats a plain `Uint8Array` and a `Buffer` (a `Uint8Array` subclass) as unequal, so
 *  every comparison against a `Buffer`-typed fixture goes through this to normalize the reader's
 *  output first. */
function toBuffers(records: readonly CaptureRecord[]): { ctx: string | number; bytes: Buffer }[] {
  return records.map((record) => ({ ctx: record.ctx, bytes: Buffer.from(record.bytes) }));
}

interface AppendSpy {
  readonly appendPort: FrameCaptureAppendPort;
  readonly appended: Buffer[];
  readonly closeCalls: { count: number };
}

function createAppendSpy(): AppendSpy {
  const appended: Buffer[] = [];
  const closeCalls = { count: 0 };
  return {
    appendPort: {
      append: (bytes) => {
        appended.push(Buffer.from(bytes));
      },
      close: () => {
        closeCalls.count += 1;
      },
    },
    appended,
    closeCalls,
  };
}

function createLogSpy(): { log: LogPort; warnings: Record<string, unknown>[]; infos: Record<string, unknown>[] } {
  const warnings: Record<string, unknown>[] = [];
  const infos: Record<string, unknown>[] = [];
  return { log: { info: (record) => infos.push(record), warn: (record) => warnings.push(record) }, warnings, infos };
}

function createCapture(overrides: Partial<FrameCaptureDeps> = {}) {
  const { appendPort, appended } = createAppendSpy();
  const { log, warnings, infos } = createLogSpy();
  const capture = createFrameCapture({
    flavor: 'dev',
    enabled: true,
    maxBytes: 10_000,
    appendPort,
    log,
    ...overrides,
  });
  return { capture, appended, warnings, infos };
}

describe('createFrameCapture: the two gates', () => {
  it('writes nothing in dev when capture is not explicitly enabled, and logs nothing', () => {
    const { capture, appended, warnings, infos } = createCapture({ flavor: 'dev', enabled: false });
    capture.push('conn', Buffer.from('frame-bytes', 'utf8'));

    expect(appended).toHaveLength(0);
    expect(warnings).toHaveLength(0);
    expect(infos).toHaveLength(0);
  });

  it('appends a record whose payload is byte-identical to what was pushed when enabled in dev', () => {
    const { capture, appended } = createCapture({ flavor: 'dev', enabled: true });
    const bytes = Buffer.from([0x81, 0x05, 0x01, 0x02, 0x03, 0x04, 0x05]);
    capture.push('conn', bytes);

    const [record] = toBuffers([...readCaptureRecords(Buffer.concat(appended))]);
    expect(record).toEqual({ ctx: 'conn', bytes });
  });

  it('emits exactly one info record naming the byte cap when active (dev and enabled)', () => {
    const { infos } = createCapture({ flavor: 'dev', enabled: true, maxBytes: 12_345 });

    expect(infos).toHaveLength(1);
    expect(infos[0]).toMatchObject({ scope: 'frame-capture', maxBytes: 12_345 });
  });

  it('writes nothing and reports exactly once when enabled outside dev, no matter how many pushes arrive', () => {
    const { capture, appended, warnings, infos } = createCapture({ flavor: 'beta', enabled: true });
    capture.push('conn', Buffer.from('a', 'utf8'));
    capture.push('conn', Buffer.from('b', 'utf8'));
    capture.push('conn', Buffer.from('c', 'utf8'));

    expect(appended).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(infos).toHaveLength(0);
  });

  it('writes nothing when disabled outside dev, and does not report anything', () => {
    const { capture, appended, warnings, infos } = createCapture({ flavor: 'prod', enabled: false });
    capture.push('conn', Buffer.from('a', 'utf8'));

    expect(appended).toHaveLength(0);
    expect(warnings).toHaveLength(0);
    expect(infos).toHaveLength(0);
  });
});

describe('createFrameCapture: round trip', () => {
  it('reads back several pushes across two ctx values, in order, with byte-identical payloads and original ctx', () => {
    const { capture, appended } = createCapture();
    const first = Buffer.from('websocket-frame-1', 'utf8');
    const second = Buffer.from('rest-response-body', 'utf8');
    const third = Buffer.from('websocket-frame-2', 'utf8');

    capture.push('ws-conn', first);
    capture.push(42, second);
    capture.push('ws-conn', third);

    const records = toBuffers([...readCaptureRecords(Buffer.concat(appended))]);
    expect(records).toEqual([
      { ctx: 'ws-conn', bytes: first },
      { ctx: 42, bytes: second },
      { ctx: 'ws-conn', bytes: third },
    ]);
  });
});

describe('createFrameCapture: the header', () => {
  it('is written exactly once across many pushes', () => {
    const { capture, appended } = createCapture();

    capture.push('conn', Buffer.from('one', 'utf8'));
    capture.push('conn', Buffer.from('two', 'utf8'));
    capture.push('conn', Buffer.from('three', 'utf8'));

    const headerBytes = Buffer.from(encodeCaptureHeader());
    expect(appended[0]).toEqual(headerBytes);
    expect(appended.filter((chunk) => chunk.equals(headerBytes))).toHaveLength(1);
    // header + 3 records = 4 append() calls total.
    expect(appended).toHaveLength(4);
  });
});

describe('createFrameCapture: the byte cap', () => {
  it('stops capture and reports exactly once once the cap is crossed, regardless of further pushes', () => {
    const headerBytes = Buffer.from(encodeCaptureHeader());
    const recordBytes = Buffer.from(encodeCaptureRecord('conn', Buffer.alloc(6, 0x61)));
    const { capture, appended, warnings } = createCapture({ maxBytes: headerBytes.length + recordBytes.length });

    capture.push('conn', Buffer.alloc(6, 0x61));
    capture.push('conn', Buffer.alloc(6, 0x61));
    capture.push('conn', Buffer.alloc(6, 0x61));
    capture.push('conn', Buffer.alloc(6, 0x61));

    expect(appended).toHaveLength(2); // header + exactly the one record that fit
    expect(warnings).toHaveLength(1);
  });

  it('accounts for the header and per-record overhead, not just payload bytes, when checking the cap', () => {
    const payload = Buffer.alloc(6, 0x61);
    const headerBytes = Buffer.from(encodeCaptureHeader());
    const recordBytes = Buffer.from(encodeCaptureRecord('conn', payload));
    // Big enough for the payload alone, too small once header + ctx + length-prefix overhead is counted.
    const { capture, appended, warnings } = createCapture({
      maxBytes: payload.length + 1,
    });
    expect(recordBytes.length + headerBytes.length).toBeGreaterThan(payload.length + 1);

    capture.push('conn', payload);

    expect(appended).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ event: 'byte_cap_reached' });
  });
});

describe('createFrameCapture: file-system failure', () => {
  it('disables capture and reports once without throwing into the frame stream', () => {
    const { log, warnings } = createLogSpy();
    const capture = createFrameCapture({
      flavor: 'dev',
      enabled: true,
      maxBytes: 10_000,
      appendPort: {
        append: () => {
          throw new Error('EACCES: permission denied');
        },
        close: () => undefined,
      },
      log,
    });

    expect(() => {
      capture.push('conn', Buffer.from('x', 'utf8'));
    }).not.toThrow();
    expect(() => {
      capture.push('conn', Buffer.from('y', 'utf8'));
    }).not.toThrow();
    expect(warnings).toHaveLength(1);
  });
});

describe('createFrameCapture: closing', () => {
  it('delegates close to the append port so the underlying file is closed cleanly', () => {
    const { appendPort, closeCalls } = createAppendSpy();
    const { log } = createLogSpy();
    const capture = createFrameCapture({ flavor: 'dev', enabled: true, maxBytes: 10_000, appendPort, log });

    capture.close();

    expect(closeCalls.count).toBe(1);
  });
});

describe('readFrameCaptureEnabledFromEnv', () => {
  it('enables capture only for the literal value "1"', () => {
    expect(readFrameCaptureEnabledFromEnv({ BFC_LIVE_FRAME_CAPTURE: '1' })).toBe(true);
  });

  it('leaves capture disabled for any other value, including unset', () => {
    expect(readFrameCaptureEnabledFromEnv({})).toBe(false);
    expect(readFrameCaptureEnabledFromEnv({ BFC_LIVE_FRAME_CAPTURE: 'true' })).toBe(false);
    expect(readFrameCaptureEnabledFromEnv({ BFC_LIVE_FRAME_CAPTURE: '0' })).toBe(false);
  });
});
