import { describe, expect, it, vi } from 'vitest';
import { RENDERER_ERROR_KEYS } from '@bombfarm/contracts';
import {
  RENDERER_ERROR_BURST,
  RENDERER_ERROR_FIELD_CAPS,
  RENDERER_ERROR_REFILL_MS,
  RENDERER_ERROR_SUPPRESSION_REPORT_MS,
  createRendererErrorGate,
  parseRendererErrorRecord,
  rendererErrorLogRecord,
} from './renderer-error-log.js';

const crash = {
  event: 'screen.crash',
  screen: 'heroes',
  message: 'boom',
  stack: 'Error: boom\n    at render (app://bundle/_next/chunk.js:1:1)',
  componentStack: '\n    at Heroes\n    at ScreenBoundary',
};

describe('parseRendererErrorRecord', () => {
  it('keeps a well-formed record exactly as sent', () => {
    expect(parseRendererErrorRecord(crash)).toEqual(crash);
  });

  it('returns exactly the five contract keys, in contract order', () => {
    expect(Object.keys(parseRendererErrorRecord(crash) ?? {})).toEqual([...RENDERER_ERROR_KEYS]);
  });

  it('drops every key outside the contract, including ones that look like log fields', () => {
    const parsed = parseRendererErrorRecord({ ...crash, scope: 'main', level: 'info', date: 1, extra: { deep: true } });
    expect(parsed).toEqual(crash);
    expect(Object.keys(parsed ?? {})).not.toContain('scope');
  });

  it.each([null, undefined, 'a string', 7, true, ['event'], () => 'x'])('rejects the non-record %j', (raw) => {
    expect(parseRendererErrorRecord(raw)).toBeNull();
  });

  it('turns a missing or non-string value into an empty string rather than keeping it', () => {
    const parsed = parseRendererErrorRecord({ event: 'screen.crash', screen: 4, message: { text: 'x' }, stack: null });
    expect(parsed).toEqual({ event: 'screen.crash', screen: '', message: '', stack: '', componentStack: '' });
  });

  it('reads own keys only, never one inherited through the prototype', () => {
    const inherited = Object.create({ message: 'from the prototype' }) as Record<string, unknown>;
    expect(parseRendererErrorRecord(inherited)?.message).toBe('');
  });

  describe('length caps', () => {
    it.each(RENDERER_ERROR_KEYS)('holds %s at exactly its cap, untouched', (key) => {
      const cap = RENDERER_ERROR_FIELD_CAPS[key];
      const parsed = parseRendererErrorRecord({ [key]: 'a'.repeat(cap) });
      expect(parsed?.[key]).toBe('a'.repeat(cap));
    });

    it.each(RENDERER_ERROR_KEYS)('cuts %s one past its cap to the cap, ending in a marker that names the original size', (key) => {
      const cap = RENDERER_ERROR_FIELD_CAPS[key];
      const value = parseRendererErrorRecord({ [key]: 'a'.repeat(cap + 1) })?.[key] ?? '';
      expect(value).toHaveLength(cap);
      expect(value.endsWith(`…[truncated, was ${String(cap + 1)} chars]`)).toBe(true);
      expect(value.startsWith('aaa')).toBe(true);
    });

    it('bounds a record of enormous fields to the sum of the caps', () => {
      const huge = 'x'.repeat(5_000_000);
      const parsed = parseRendererErrorRecord({ event: huge, screen: huge, message: huge, stack: huge, componentStack: huge });
      const total = RENDERER_ERROR_KEYS.reduce((sum, key) => sum + (parsed?.[key].length ?? 0), 0);
      expect(total).toBe(RENDERER_ERROR_KEYS.reduce((sum, key) => sum + RENDERER_ERROR_FIELD_CAPS[key], 0));
    });

    it('never leaves half a surrogate pair at the cut', () => {
      const cap = RENDERER_ERROR_FIELD_CAPS.event;
      const total = cap + 40;
      const marker = `…[truncated, was ${String(total)} chars]`;
      const keep = cap - marker.length;
      const value = 'a'.repeat(keep - 1) + '😀' + 'b'.repeat(total - keep - 1);
      expect(value).toHaveLength(total);
      const cut = parseRendererErrorRecord({ event: value })?.event ?? '';
      expect(cut).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
      expect(cut).toBe('a'.repeat(keep - 1) + marker);
    });
  });

  describe('control characters', () => {
    it('removes escapes and NUL but keeps the newlines and tabs a stack trace is made of', () => {
      const parsed = parseRendererErrorRecord({ message: 'a\u001b[31mred\u0000\u0007\u007f', stack: 'x\n\tat y\r\n' });
      expect(parsed?.message).toBe('a[31mred');
      expect(parsed?.stack).toBe('x\n\tat y\n');
    });

    it('removes them from the kept head of a truncated field as well', () => {
      const parsed = parseRendererErrorRecord({ message: '\u001b'.repeat(10) + 'z'.repeat(RENDERER_ERROR_FIELD_CAPS.message) });
      expect(parsed?.message).not.toContain('\u001b');
      expect(parsed?.message.endsWith('chars]')).toBe(true);
    });
  });
});

describe('rendererErrorLogRecord', () => {
  it('puts scope renderer first and leaves the fields as they were', () => {
    const record = rendererErrorLogRecord(crash);
    expect(Object.keys(record)).toEqual(['scope', ...RENDERER_ERROR_KEYS]);
    expect(record).toEqual({ scope: 'renderer', ...crash });
  });

  it('cannot have its scope replaced by a page, whatever the page sent', () => {
    const forged = parseRendererErrorRecord({ ...crash, scope: 'main' });
    expect(rendererErrorLogRecord(forged as NonNullable<typeof forged>).scope).toBe('renderer');
  });
});

describe('createRendererErrorGate', () => {
  function gateAt(start = 1_000_000) {
    const clock = { ms: start };
    const warn = vi.fn();
    const scheduled: { callback: () => void; delayMs: number }[] = [];
    const gate = createRendererErrorGate({
      now: () => clock.ms,
      warn,
      schedule: (callback, delayMs) => {
        scheduled.push({ callback, delayMs });
      },
    });
    return { gate, clock, warn, scheduled };
  }

  it('admits a burst, then refuses the next call', () => {
    const { gate } = gateAt();
    const outcomes = Array.from({ length: RENDERER_ERROR_BURST + 2 }, () => gate.admit('main'));
    expect(outcomes).toEqual([...Array<boolean>(RENDERER_ERROR_BURST).fill(true), false, false]);
  });

  it('admits one more per refill interval, and no more than the burst after a long quiet', () => {
    const { gate, clock } = gateAt();
    for (let i = 0; i < RENDERER_ERROR_BURST; i += 1) gate.admit('main');
    expect(gate.admit('main')).toBe(false);

    clock.ms += RENDERER_ERROR_REFILL_MS;
    expect(gate.admit('main')).toBe(true);
    expect(gate.admit('main')).toBe(false);

    clock.ms += RENDERER_ERROR_REFILL_MS * 100;
    const after = Array.from({ length: RENDERER_ERROR_BURST + 1 }, () => gate.admit('main'));
    expect(after.filter(Boolean)).toHaveLength(RENDERER_ERROR_BURST);
  });

  it('keeps a window of its own: a noisy main window leaves the compact window its full burst', () => {
    const { gate } = gateAt();
    for (let i = 0; i < RENDERER_ERROR_BURST * 3; i += 1) gate.admit('main');
    const mini = Array.from({ length: RENDERER_ERROR_BURST }, () => gate.admit('mini-live'));
    expect(mini.every(Boolean)).toBe(true);
  });

  it('tolerates a clock that steps backwards without minting tokens', () => {
    const { gate, clock } = gateAt();
    for (let i = 0; i < RENDERER_ERROR_BURST; i += 1) gate.admit('main');
    clock.ms -= 10 * RENDERER_ERROR_REFILL_MS;
    expect(gate.admit('main')).toBe(false);
  });

  it('writes nothing, and schedules nothing, while every call is admitted', () => {
    const { gate, warn, scheduled } = gateAt();
    for (let i = 0; i < RENDERER_ERROR_BURST; i += 1) gate.admit('main');
    expect(warn).not.toHaveBeenCalled();
    expect(scheduled).toEqual([]);
  });

  it('reports what it dropped as one line when the report timer fires, then starts counting afresh', () => {
    const { gate, warn, scheduled } = gateAt();
    for (let i = 0; i < RENDERER_ERROR_BURST + 4; i += 1) gate.admit('main');

    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.delayMs).toBe(RENDERER_ERROR_SUPPRESSION_REPORT_MS);
    expect(warn).not.toHaveBeenCalled();

    scheduled[0]?.callback();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith({
      scope: 'renderer',
      event: 'error_log.suppressed',
      window: 'main',
      suppressed: 4,
    });

    expect(gate.admit('main')).toBe(false);
    expect(scheduled).toHaveLength(2);
    scheduled[1]?.callback();
    expect(warn).toHaveBeenLastCalledWith(expect.objectContaining({ suppressed: 1 }));
  });

  it('schedules one report per window, not one per dropped call', () => {
    const { gate, scheduled } = gateAt();
    for (let i = 0; i < RENDERER_ERROR_BURST * 4; i += 1) gate.admit('main');
    for (let i = 0; i < RENDERER_ERROR_BURST * 4; i += 1) gate.admit('mini-live');
    expect(scheduled).toHaveLength(2);
  });

  it('refuses a flood from the very first call at a bounded rate: a thousand calls in one second admit only the burst', () => {
    const { gate } = gateAt();
    const admitted = Array.from({ length: 1000 }, () => gate.admit('mini-live')).filter(Boolean);
    expect(admitted).toHaveLength(RENDERER_ERROR_BURST);
  });
});

describe('the default report timer', () => {
  it('fires through a real timer that does not hold the process open', () => {
    vi.useFakeTimers();
    try {
      const warn = vi.fn();
      const clock = { ms: 0 };
      const gate = createRendererErrorGate({ now: () => clock.ms, warn });
      for (let i = 0; i < RENDERER_ERROR_BURST + 1; i += 1) gate.admit('main');
      vi.advanceTimersByTime(RENDERER_ERROR_SUPPRESSION_REPORT_MS - 1);
      expect(warn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(warn).toHaveBeenCalledWith(expect.objectContaining({ event: 'error_log.suppressed', suppressed: 1 }));
    } finally {
      vi.useRealTimers();
    }
  });
});
