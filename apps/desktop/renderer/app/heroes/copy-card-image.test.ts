import { describe, expect, it, vi } from 'vitest';

vi.mock('html-to-image', () => ({
  toSvg: vi.fn(() => Promise.reject(new Error('no DOM to draw'))),
}));

const { copyCardImage } = await import('./copy-card-image');

describe('copyCardImage', () => {
  it('answers false, and writes nothing, when the card cannot be drawn', async () => {
    const writeImage = vi.fn();
    const card = { offsetWidth: 680, offsetHeight: 1000 } as unknown as HTMLElement;
    await expect(copyCardImage(card, writeImage)).resolves.toBe(false);
    expect(writeImage).not.toHaveBeenCalled();
  });
});
