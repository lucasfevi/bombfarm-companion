import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// `Symbol.for("motionComponentSymbol")` is a string literal in motion's runtime, so it survives
// minification (module ids and function names do not) and appears in no other chunk of a build.
export const MOTION_MARKER = 'motionComponentSymbol';

const SCRIPT_SRC = /<script[^>]*\ssrc="\/_next\/(static\/[^"]+\.js)"/g;

export function loadedChunks(distDir: string, pageHtml: string): string[] {
  const html = readFileSync(path.join(distDir, 'server', 'app', pageHtml), 'utf8');
  return [...html.matchAll(SCRIPT_SRC)].map((match) => match[1] as string);
}

// Base UI's menu is the only code in a build that names the `menuitemradio` role; React's own
// bundle knows `menuitem` but not this one, and a string literal survives minification.
export const BASE_UI_MENU_MARKER = 'menuitemradio';

export function chunksContaining(distDir: string, chunks: readonly string[], marker: string): string[] {
  return chunks.filter((chunk) => readFileSync(path.join(distDir, chunk), 'utf8').includes(marker));
}

export function chunksContainingMotion(distDir: string, chunks: readonly string[]): string[] {
  return chunksContaining(distDir, chunks, MOTION_MARKER);
}

const CHUNK_REQUEST = /\.e\((\d+)\)/g;

export function lazilyRequestedChunks(distDir: string, chunks: readonly string[]): string[] {
  const available = readdirSync(path.join(distDir, 'static', 'chunks')).filter((name) => name.endsWith('.js'));
  const requested = new Set<string>();
  for (const chunk of chunks) {
    const source = readFileSync(path.join(distDir, chunk), 'utf8');
    for (const match of source.matchAll(CHUNK_REQUEST)) {
      const file = available.find((name) => name.startsWith(`${match[1]}-`) || name.startsWith(`${match[1]}.`));
      if (file) requested.add(`static/chunks/${file}`);
    }
  }
  return [...requested];
}
