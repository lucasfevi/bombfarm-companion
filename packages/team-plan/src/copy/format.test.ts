import { describe, expect, it } from 'vitest';
import { parseEmphasis } from './format';

describe('parseEmphasis', () => {
  it('returns the whole string as text when there is no marker', () => {
    expect(parseEmphasis('plain')).toEqual([{ kind: 'text', value: 'plain' }]);
  });

  it('splits one marker into text/em/text', () => {
    expect(parseEmphasis('before <em>mid</em> after')).toEqual([
      { kind: 'text', value: 'before ' },
      { kind: 'em', value: 'mid' },
      { kind: 'text', value: ' after' },
    ]);
  });

  it('splits two markers', () => {
    expect(parseEmphasis('<em>a</em> and <em>b</em>')).toEqual([
      { kind: 'em', value: 'a' },
      { kind: 'text', value: ' and ' },
      { kind: 'em', value: 'b' },
    ]);
  });

  it('handles a marker at the very start', () => {
    expect(parseEmphasis('<em>start</em> rest')).toEqual([
      { kind: 'em', value: 'start' },
      { kind: 'text', value: ' rest' },
    ]);
  });

  it('handles a marker at the very end', () => {
    expect(parseEmphasis('rest <em>end</em>')).toEqual([
      { kind: 'text', value: 'rest ' },
      { kind: 'em', value: 'end' },
    ]);
  });
});
