import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { elapsedWholeSeconds } from '@/features/home/model/use-elapsed-seconds';

describe('the elapsed-seconds clock', () => {
  it('counts whole seconds since the run started', () => {
    expect(elapsedWholeSeconds(0, 999)).toBe(0);
    expect(elapsedWholeSeconds(0, 1000)).toBe(1);
    expect(elapsedWholeSeconds(0, 61_500)).toBe(61);
    expect(elapsedWholeSeconds(5_000, 7_999)).toBe(2);
  });

  it('restarts the clock on a new run and stops it when the run ends', () => {
    const source = readFileSync(resolve(__dirname, '../features/home/model/use-elapsed-seconds.ts'), 'utf8');
    expect(source.match(/useEffect\(/g)).toHaveLength(1);
    const dependencies = /\}, \[([^\]]*)\]\);/.exec(source);
    expect((dependencies?.[1] ?? '').split(',').map((name) => name.trim())).toEqual(['runId', 'running']);
    expect(source).toContain('setInterval(');
    expect(source).toContain('clearInterval(');
    expect(source).toMatch(/return \(\) =>[^;]*clearInterval\(/);
    expect(source).toContain('performance.now()');
    expect(source).toContain('elapsedWholeSeconds(');
  });
});
