/**
 * The roster rail sits beside the detail pane on a wide window and is replaced by a picker below
 * the breakpoint. There is no render harness in this repository, and the launch suite measures the
 * top bar rather than this screen, so the pairing is pinned against the source: the two halves must
 * name the SAME threshold and must be each other's complement. A rail that hides at one width while
 * its stand-in appears at another leaves a window with neither, or with both.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, 'heroes-view.tsx'), 'utf8');

const railHiddenBelow = 'max-[1099px]:hidden';
const pickerHiddenAbove = 'min-[1100px]:hidden';
const twoColumnsAbove = 'min-[1100px]:grid-cols-';

describe('the Heroes screen collapses its roster at one threshold', () => {
  it('non-vacuity: the source was read and it is the screen it claims to be', () => {
    expect(source).toContain('RosterRail');
    expect(source.length).toBeGreaterThan(2000);
  });

  it('gives the detail pane a second column only above the breakpoint', () => {
    expect(source).toContain(twoColumnsAbove);
    expect(source).toContain('grid-cols-1');
  });

  it('hides the rail below the same width at which the picker appears', () => {
    expect(source).toContain(railHiddenBelow);
    expect(source).toContain(pickerHiddenAbove);
  });

  it('never leaves a width with both the rail and its stand-in, or with neither', () => {
    const railHiddenAt = Number(/max-\[(\d+)px\]:hidden/.exec(source)?.[1]);
    const pickerHiddenAt = Number(/min-\[(\d+)px\]:hidden/.exec(source)?.[1]);

    expect(railHiddenAt).toBe(pickerHiddenAt - 1);
  });
});
