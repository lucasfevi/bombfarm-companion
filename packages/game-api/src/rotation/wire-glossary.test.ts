import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderWireGlossary } from './lexicon.js';

const DOC_PATH = fileURLToPath(new URL('../../../../docs/wire-vocabulary.md', import.meta.url));

describe('docs/wire-vocabulary.md staleness', () => {
  it('equals renderWireGlossary() — regenerate with `pnpm generate:wire-vocabulary` (run `pnpm build` first) and commit the result', () => {
    const committed = readFileSync(DOC_PATH, 'utf8');
    expect(committed).toBe(renderWireGlossary());
  });
});
