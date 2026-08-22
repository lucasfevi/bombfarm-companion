import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateReplayStream } from './generate-replay-stream.js';

/** `__dirname`, not `import.meta.url`: `tsconfig.main.json` builds this tree to CommonJS. */
const HERE = __dirname;
const COMMITTED_PATH = resolve(HERE, 'replay-stream.bin');

describe('replay stream fixture', () => {
  it('matches the committed byte stream the generator produces from its default seed', () => {
    const committed = readFileSync(COMMITTED_PATH);
    const generated = generateReplayStream().bytes;

    expect(generated.length).toBe(committed.length);
    expect(generated.equals(committed)).toBe(true);
  });
});
