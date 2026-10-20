import { readFileSync } from 'node:fs';
import path from 'node:path';

// `Symbol.for("motionComponentSymbol")` is a string literal in motion's runtime, so it survives
// minification (module ids and function names do not) and appears in no other chunk of a build.
export const MOTION_MARKER = 'motionComponentSymbol';

const SCRIPT_SRC = /<script[^>]*\ssrc="\/_next\/(static\/[^"]+\.js)"/g;

export function loadedChunks(distDir: string, pageHtml: string): string[] {
  const html = readFileSync(path.join(distDir, 'server', 'app', pageHtml), 'utf8');
  return [...html.matchAll(SCRIPT_SRC)].map((match) => match[1] as string);
}

export function chunksContainingMotion(distDir: string, chunks: readonly string[]): string[] {
  return chunks.filter((chunk) =>
    readFileSync(path.join(distDir, chunk), 'utf8').includes(MOTION_MARKER),
  );
}
