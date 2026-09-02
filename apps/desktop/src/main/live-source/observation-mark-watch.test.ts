import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMarkWatch } from './observation-mark-watch.js';
import { createObservationCapture } from './observation-capture.js';

const MARK_PATH = 'C:\\capture\\observation-capture\\mark.txt';

function watchOver(file: { content: string | null; readFailure?: Error | undefined }) {
  const marks: string[] = [];
  const watch = createMarkWatch({
    path: MARK_PATH,
    readFile: () => {
      if (file.readFailure) throw file.readFailure;
      return file.content;
    },
    onMark: (label) => marks.push(label),
    intervalMs: 500,
  });
  return { watch, marks };
}

describe('createMarkWatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires only when the content changes, not once per poll', () => {
    const file = { content: null as string | null };
    const { watch, marks } = watchOver(file);
    watch.start();

    file.content = '1 opened a cage';
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(500);

    expect(marks).toEqual(['opened a cage']);
    watch.stop();
  });

  it('fires again for the same label because the launcher changes the ordinal', () => {
    const file = { content: null as string | null };
    const { watch, marks } = watchOver(file);
    watch.start();

    file.content = '1 opened a cage';
    vi.advanceTimersByTime(500);
    file.content = '2 opened a cage';
    vi.advanceTimersByTime(500);

    expect(marks).toEqual(['opened a cage', 'opened a cage']);
    watch.stop();
  });

  it('adopts a mark file left by an earlier run without replaying it into this one', () => {
    const file = { content: '7 from the previous session' as string | null };
    const { watch, marks } = watchOver(file);
    watch.start();
    vi.advanceTimersByTime(500);

    expect(marks).toEqual([]);
    watch.stop();
  });

  it('swallows a read failure and keeps polling, so a lost annotation is never a lost recording', () => {
    const file = { content: null as string | null, readFailure: undefined as Error | undefined };
    const { watch, marks } = watchOver(file);
    watch.start();

    file.readFailure = new Error('EBUSY: resource busy or locked');
    expect(() => {
      vi.advanceTimersByTime(500);
    }).not.toThrow();

    file.readFailure = undefined;
    file.content = '1 back again';
    vi.advanceTimersByTime(500);

    expect(marks).toEqual(['back again']);
    watch.stop();
  });

  it('stops polling once stopped', () => {
    const file = { content: null as string | null };
    const { watch, marks } = watchOver(file);
    watch.start();
    watch.stop();

    file.content = '1 after stop';
    vi.advanceTimersByTime(5_000);

    expect(marks).toEqual([]);
  });
});

describe('a mark lands between the observations that surround it', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('appears in sequence order between the body before it and the body after it', () => {
    const lines: string[] = [];
    const capture = createObservationCapture({
      enabled: true,
      isPackaged: false,
      destination: 'unused',
      appendPort: { append: (line) => lines.push(line), close: () => undefined },
      log: { info: () => undefined, warn: () => undefined },
      now: () => Date.now(),
    });
    const file = { content: null as string | null };
    const watch = createMarkWatch({
      path: MARK_PATH,
      readFile: () => file.content,
      onMark: (label) => {
        capture.mark(label, Date.now());
      },
      intervalMs: 500,
    });
    watch.start();

    capture.body(Buffer.from(JSON.stringify({ before: true }), 'utf8'), Date.now());
    file.content = '1 opened a cage';
    vi.advanceTimersByTime(500);
    capture.body(Buffer.from(JSON.stringify({ after: true }), 'utf8'), Date.now());
    watch.stop();

    const records = lines.map((line) => JSON.parse(line.slice(0, -1)) as Record<string, unknown>);
    expect(records.map((record) => record.kind)).toEqual(['session', 'body', 'mark', 'body']);
    const markSeq = records.find((record) => record.kind === 'mark')?.seq as number;
    const bodies = records.filter((record) => record.kind === 'body').map((record) => record.seq as number);
    expect(bodies[0]).toBeLessThan(markSeq);
    expect(bodies[1]).toBeGreaterThan(markSeq);
  });
});
