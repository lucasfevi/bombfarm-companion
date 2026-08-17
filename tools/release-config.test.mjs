import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

const WORKSPACE_PACKAGES = [
  { name: '@bombfarm/web', path: 'apps/web/package.json' },
  { name: '@bombfarm/desktop', path: 'apps/desktop/package.json' },
  { name: '@bombfarm/contracts', path: 'packages/contracts/package.json' },
  { name: '@bombfarm/domain', path: 'packages/domain/package.json' },
  { name: '@bombfarm/game-api', path: 'packages/game-api/package.json' },
  { name: '@bombfarm/game-data', path: 'packages/game-data/package.json' },
  { name: '@bombfarm/pricing', path: 'packages/pricing/package.json' },
  { name: '@bombfarm/ui', path: 'packages/ui/package.json' },
];

const PUBLISH_PATTERNS = [
  /\bnpm\s+publish\b/,
  /\bpnpm\s+publish\b/,
  /\bchangeset\s+publish\b/,
];

describe('changeset config', () => {
  const config = readJson('.changeset/config.json');

  it('uses the changesets default changelog generator', () => {
    expect(config.changelog).toBe('@changesets/cli/changelog');
  });

  it('does not auto-commit version bumps', () => {
    expect(config.commit).toBe(false);
  });

  it('has no fixed or linked version groups', () => {
    expect(config.fixed).toEqual([]);
    expect(config.linked).toEqual([]);
  });

  it('restricts access and targets develop as the base branch', () => {
    expect(config.access).toBe('restricted');
    expect(config.baseBranch).toBe('develop');
  });

  it('bumps internal dependencies on patch', () => {
    expect(config.updateInternalDependencies).toBe('patch');
  });

  it('does not restrict workspace protocol bumps to protocol-only mode', () => {
    expect(config.bumpVersionsWithWorkspaceProtocolOnly).toBe(false);
  });

  it('has an empty ignore list', () => {
    expect(config.ignore).toEqual([]);
  });

  it('versions private packages without tagging them', () => {
    expect(config.privatePackages).toEqual({ version: true, tag: false });
  });
});

describe('workspace package privacy', () => {
  for (const pkg of WORKSPACE_PACKAGES) {
    it(`${pkg.name} is private`, () => {
      const manifest = readJson(pkg.path);
      expect(manifest.private).toBe(true);
    });
  }
});

describe('changeset package selector coverage', () => {
  it('offers the same eight workspace packages changesets would version', async () => {
    const { getPackages } = await import('@manypkg/get-packages');
    const { packages } = await getPackages(root);
    const discoveredNames = packages
      .map((pkg) => pkg.packageJson.name)
      .filter((name) => typeof name === 'string')
      .sort((left, right) => left.localeCompare(right));
    const expectedNames = WORKSPACE_PACKAGES.map((pkg) => pkg.name).sort((left, right) =>
      left.localeCompare(right),
    );

    expect(discoveredNames).toEqual(expectedNames);
    expect(discoveredNames).toHaveLength(8);
  });
});

describe('no publish commands in automation', () => {
  it('root scripts do not invoke publish', () => {
    const { scripts = {} } = readJson('package.json');
    const scriptText = Object.values(scripts).join('\n');
    for (const pattern of PUBLISH_PATTERNS) {
      expect(scriptText).not.toMatch(pattern);
    }
  });

  it('workflow files do not invoke publish', () => {
    const workflowDir = join(root, '.github/workflows');
    const workflowText = readdirSync(workflowDir)
      .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
      .map((name) => readFileSync(join(workflowDir, name), 'utf8'))
      .join('\n');
    for (const pattern of PUBLISH_PATTERNS) {
      expect(workflowText).not.toMatch(pattern);
    }
  });

  it('package.json scripts across the workspace do not invoke publish', () => {
    const scriptText = WORKSPACE_PACKAGES
      .map((pkg) => readJson(pkg.path).scripts ?? {})
      .flatMap((scripts) => Object.values(scripts))
      .join('\n');
    for (const pattern of PUBLISH_PATTERNS) {
      expect(scriptText).not.toMatch(pattern);
    }
  });
});
