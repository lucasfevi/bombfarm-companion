/**
 * The share card, turned into a PNG at twice its size and put on the system clipboard.
 *
 * Drawn from the DOM rather than photographed off the screen: a photograph holds only the pixels
 * the window is showing — at the display's own scale, and nothing scrolled out of the dialog — and
 * a hidden or minimised window has none. The picture is the card's own markup laid into an SVG
 * with every font and image inlined, then painted onto a canvas at a fixed ratio, so it is the
 * same image on every screen.
 *
 * The library's own canvas step waits on an animation frame, which a window that is not being
 * painted never gets; the paint here waits on the image alone.
 */
import { toSvg } from 'html-to-image';
import type { ClipboardImageResult } from '@bombfarm/contracts';

export const SHARE_IMAGE_PIXEL_RATIO = 2;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error('share card image did not load'));
    };
    image.src = src;
  });
}

function canvasPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('share card canvas produced no image'));
    }, 'image/png');
  });
}

export async function renderCardPng(card: HTMLElement, pixelRatio = SHARE_IMAGE_PIXEL_RATIO): Promise<Uint8Array> {
  const width = card.offsetWidth;
  const height = card.offsetHeight;
  const svg = await toSvg(card, { width, height });
  const image = await loadImage(svg);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('share card canvas has no 2d context');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Uint8Array(await (await canvasPng(canvas)).arrayBuffer());
}

export type WriteClipboardImage = (png: Uint8Array) => Promise<ClipboardImageResult>;

/** Resolves whether the picture reached the clipboard. Never rejects: a failure is something the
 *  panel tells the player, not an error for the caller to handle. */
export async function copyCardImage(card: HTMLElement, writeImage: WriteClipboardImage): Promise<boolean> {
  try {
    const result = await writeImage(await renderCardPng(card));
    return result.ok;
  } catch {
    return false;
  }
}
