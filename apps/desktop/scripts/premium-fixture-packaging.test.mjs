import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createBuilderConfig } from './builder-config.mjs';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('the Premium fixture bundle', () => {
  it('lives outside every folder the packager takes files from', () => {
    const fixtureTop = relative(appRoot, join(appRoot, 'tests', 'fixtures', 'premium')).split(sep)[0];
    for (const flavor of ['dev', 'beta', 'prod']) {
      const patterns = createBuilderConfig(flavor).files;
      const roots = patterns.filter((p) => !p.startsWith('!')).map((p) => p.split('/')[0]);
      expect(roots).not.toContain(fixtureTop);
      expect(patterns.some((p) => p.includes('fixtures'))).toBe(false);
    }
  });
});
