import { describe, expect, it } from 'vitest';
import { sizeMiniLiveFit } from './measure-mini-live-fit';

describe('sizeMiniLiveFit', () => {
  it('stacks children on the vertical axis and includes chrome', () => {
    expect(
      sizeMiniLiveFit({
        chromeHeight: 32,
        axis: 'vertical',
        paddingX: 16,
        paddingY: 16,
        gap: 8,
        children: [
          { width: 200, height: 80 },
          { width: 240, height: 120 },
        ],
      }),
    ).toEqual({ width: 256, height: 256 });
  });

  it('rows children on the horizontal axis and includes chrome', () => {
    expect(
      sizeMiniLiveFit({
        chromeHeight: 32,
        axis: 'horizontal',
        paddingX: 16,
        paddingY: 16,
        gap: 8,
        children: [
          { width: 200, height: 80 },
          { width: 240, height: 120 },
        ],
      }),
    ).toEqual({ width: 464, height: 168 });
  });
});
