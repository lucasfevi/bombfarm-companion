import { describe, expect, it } from 'vitest';
import { isWindowRevealSuppressed } from './window-reveal.js';

const HIDDEN = { BFC_HIDE_WINDOWS: '1' } as const;

describe('isWindowRevealSuppressed: the full gate table', () => {
  it('stays off when packaged even with the enabling variable set', () => {
    expect(isWindowRevealSuppressed(HIDDEN, true)).toBe(false);
  });

  it('stays off when packaged and unset', () => {
    expect(isWindowRevealSuppressed({}, true)).toBe(false);
  });

  it('turns on unpackaged with the variable set', () => {
    expect(isWindowRevealSuppressed(HIDDEN, false)).toBe(true);
  });

  it('stays off unpackaged when unset', () => {
    expect(isWindowRevealSuppressed({}, false)).toBe(false);
  });

  it('takes only the exact value, not any truthy string', () => {
    expect(isWindowRevealSuppressed({ BFC_HIDE_WINDOWS: 'true' }, false)).toBe(false);
    expect(isWindowRevealSuppressed({ BFC_HIDE_WINDOWS: '0' }, false)).toBe(false);
    expect(isWindowRevealSuppressed({ BFC_HIDE_WINDOWS: '' }, false)).toBe(false);
  });
});
