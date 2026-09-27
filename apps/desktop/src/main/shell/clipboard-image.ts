import type { ClipboardImageResult } from '@bombfarm/contracts';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/** A share card at twice its size is well under 4 MB; anything this large was not one. */
export const MAX_CLIPBOARD_IMAGE_BYTES = 32 * 1024 * 1024;

type DecodedImage = {
  isEmpty(): boolean;
  getSize(): { width: number; height: number };
};

export type ImageClipboard<Image extends DecodedImage> = {
  decodePng(bytes: Buffer): Image;
  writeImage(image: Image): void;
};

export function isPngBytes(value: unknown): value is Uint8Array {
  if (!(value instanceof Uint8Array)) return false;
  if (value.byteLength <= PNG_SIGNATURE.length || value.byteLength > MAX_CLIPBOARD_IMAGE_BYTES) return false;
  return PNG_SIGNATURE.every((byte, index) => value[index] === byte);
}

/** The renderer is not trusted to have sent a picture: the bytes are checked and decoded here,
 *  and only a PNG that decodes to something reaches the clipboard. */
export function writeClipboardImage<Image extends DecodedImage>(
  bytes: unknown,
  clipboard: ImageClipboard<Image>,
): ClipboardImageResult {
  if (!isPngBytes(bytes)) return { ok: false, reason: 'not-an-image' };
  const image = clipboard.decodePng(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  if (image.isEmpty()) return { ok: false, reason: 'not-an-image' };
  try {
    clipboard.writeImage(image);
  } catch {
    return { ok: false, reason: 'write-failed' };
  }
  const { width, height } = image.getSize();
  return { ok: true, width, height };
}
