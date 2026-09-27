import { describe, expect, it, vi } from 'vitest';
import { MAX_CLIPBOARD_IMAGE_BYTES, isPngBytes, writeClipboardImage } from './clipboard-image';

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngBytes(): Uint8Array {
  return new Uint8Array([...PNG_HEAD, 0, 0, 0, 13]);
}

function fakeClipboard(size = { width: 1360, height: 2000 }, empty = false) {
  const image = { isEmpty: () => empty, getSize: () => size };
  return { image, clipboard: { decodePng: vi.fn(() => image), writeImage: vi.fn() } };
}

describe('isPngBytes', () => {
  it('accepts bytes that open with the PNG signature', () => {
    expect(isPngBytes(pngBytes())).toBe(true);
  });

  it('refuses anything else the renderer could send', () => {
    expect(isPngBytes('iVBORw0KGgo=')).toBe(false);
    expect(isPngBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0]))).toBe(false);
    expect(isPngBytes(new Uint8Array(PNG_HEAD))).toBe(false);
    expect(isPngBytes(null)).toBe(false);
  });

  it('refuses a body too large to be a card', () => {
    const huge = new Uint8Array(MAX_CLIPBOARD_IMAGE_BYTES + 1);
    huge.set(PNG_HEAD);
    expect(isPngBytes(huge)).toBe(false);
  });
});

describe('writeClipboardImage', () => {
  it('writes a decoded PNG and answers with its size', () => {
    const { image, clipboard } = fakeClipboard();
    expect(writeClipboardImage(pngBytes(), clipboard)).toEqual({ ok: true, width: 1360, height: 2000 });
    expect(clipboard.writeImage).toHaveBeenCalledWith(image);
  });

  it('writes nothing for bytes that are not a PNG', () => {
    const { clipboard } = fakeClipboard();
    expect(writeClipboardImage(new Uint8Array([1, 2, 3]), clipboard)).toEqual({ ok: false, reason: 'not-an-image' });
    expect(clipboard.decodePng).not.toHaveBeenCalled();
    expect(clipboard.writeImage).not.toHaveBeenCalled();
  });

  it('writes nothing for a PNG that decodes to no picture', () => {
    const { clipboard } = fakeClipboard(undefined, true);
    expect(writeClipboardImage(pngBytes(), clipboard)).toEqual({ ok: false, reason: 'not-an-image' });
    expect(clipboard.writeImage).not.toHaveBeenCalled();
  });

  it('says so when the clipboard write itself throws', () => {
    const { clipboard } = fakeClipboard();
    clipboard.writeImage.mockImplementation(() => {
      throw new Error('clipboard busy');
    });
    expect(writeClipboardImage(pngBytes(), clipboard)).toEqual({ ok: false, reason: 'write-failed' });
  });
});
