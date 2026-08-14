import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireBuildOutput } from './support/build-output';

const root = resolve(__dirname, '../..');
const outRoot = resolve(root, 'out');

/**
 * `R-C1`/`R-C2` (`AD-PFR-17`): the static export must carry an artifact for BOTH `/farm`
 * (the renamed page) and `/phases` (the redirect stub). Next's static exporter emits either
 * `<route>.html` or `<route>/index.html` depending on trailing-slash config — this checks both
 * shapes so the assertion is not coupled to that config's current value.
 */
function routeArtifactExists(route: string): boolean {
  return existsSync(resolve(outRoot, `${route}.html`)) || existsSync(resolve(outRoot, route, 'index.html'));
}

describe('farm route build output', () => {
  it('out/ carries an artifact for /farm', () => {
    if (!requireBuildOutput(outRoot, 'out/ contains a /farm artifact')) return;
    expect(routeArtifactExists('farm'), `no farm.html or farm/index.html under ${outRoot}`).toBe(true);
  });

  it('out/ carries an artifact for /phases (the redirect stub)', () => {
    if (!requireBuildOutput(outRoot, 'out/ contains a /phases artifact')) return;
    expect(routeArtifactExists('phases'), `no phases.html or phases/index.html under ${outRoot}`).toBe(
      true,
    );
  });

  it('the /farm document declares a Farm title', () => {
    if (!requireBuildOutput(outRoot, '/farm document has a Farm title')) return;
    const path = existsSync(resolve(outRoot, 'farm.html'))
      ? resolve(outRoot, 'farm.html')
      : resolve(outRoot, 'farm', 'index.html');
    const html = readFileSync(path, 'utf8');
    expect(html).toMatch(/<title>[^<]*Farm[^<]*<\/title>/);
  });
});
