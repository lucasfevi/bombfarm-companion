import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  APP_FLAVORS,
  FLAVORS,
  getFlavorDescriptor,
} from '@bombfarm/contracts';
import { createBuilderConfig } from './builder-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..');
const desktopPackageJson = JSON.parse(
  readFileSync(path.join(desktopRoot, 'package.json'), 'utf8'),
);

function collectSourceFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('createBuilderConfig', () => {
  for (const flavor of APP_FLAVORS) {
    describe(flavor, () => {
      const descriptor = getFlavorDescriptor(flavor);
      const config = createBuilderConfig(flavor);

      it('emits appId from the descriptor', () => {
        expect(config.appId).toBe(descriptor.appId);
      });

      it('emits productName from the descriptor', () => {
        expect(config.productName).toBe(descriptor.productName);
      });

      it('emits directories.output from the descriptor', () => {
        expect(config.directories?.output).toBe(descriptor.outputDir);
      });

      it('keeps buildResources at assets', () => {
        expect(config.directories?.buildResources).toBe('assets');
      });

      it('stamps extraMetadata.name and bfcFlavor', () => {
        expect(config.extraMetadata).toEqual({
          name: descriptor.packageName,
          bfcFlavor: flavor,
        });
      });

      it('uses artifactName with ${name} for coexistence', () => {
        expect(config.artifactName).toBe('${name}-${version}-setup.${ext}');
        expect(config.artifactName).toContain('${name}');
      });

      it('keeps the shared files / win / nsis blocks', () => {
        expect(config.files).toEqual([
          'dist/**/*',
          'renderer/out/**/*',
          'package.json',
          '!**/*.map',
        ]);
        expect(config.win).toEqual({
          target: [{ target: 'nsis', arch: ['x64'] }],
        });
        expect(config.nsis).toEqual({
          oneClick: true,
          perMachine: false,
          allowToChangeInstallationDirectory: false,
        });
      });

      if (descriptor.updateChannel === null) {
        it('omits publish for dev', () => {
          expect(config.publish).toBeNull();
        });
      } else {
        it('declares github publish with the descriptor channel only', () => {
          expect(config.publish).toEqual([
            { provider: 'github', channel: descriptor.updateChannel },
          ]);
          expect(JSON.stringify(config.publish)).not.toMatch(/owner|repo/);
        });
      }
    });
  }

  it('does not share appId across flavors', () => {
    const appIds = APP_FLAVORS.map((flavor) => createBuilderConfig(flavor).appId);
    expect(new Set(appIds).size).toBe(APP_FLAVORS.length);
  });

  it('does not share productName across flavors', () => {
    const names = APP_FLAVORS.map((flavor) => createBuilderConfig(flavor).productName);
    expect(new Set(names).size).toBe(APP_FLAVORS.length);
  });

  it('does not share directories.output across flavors', () => {
    const outputs = APP_FLAVORS.map(
      (flavor) => createBuilderConfig(flavor).directories?.output,
    );
    expect(new Set(outputs).size).toBe(APP_FLAVORS.length);
  });

  it('does not share extraMetadata.name across flavors', () => {
    const names = APP_FLAVORS.map(
      (flavor) => createBuilderConfig(flavor).extraMetadata?.name,
    );
    expect(new Set(names).size).toBe(APP_FLAVORS.length);
  });

  it('matches FLAVORS matrix outputDir values', () => {
    for (const flavor of APP_FLAVORS) {
      expect(createBuilderConfig(flavor).directories?.output).toBe(FLAVORS[flavor].outputDir);
    }
  });
});

describe('FLV-18a — no auto-update wiring', () => {
  it('does not depend on electron-updater', () => {
    const deps = {
      ...desktopPackageJson.dependencies,
      ...desktopPackageJson.devDependencies,
      ...desktopPackageJson.optionalDependencies,
    };
    expect(deps).not.toHaveProperty('electron-updater');
  });

  it('does not reference autoUpdater in desktop source', () => {
    const srcRoot = path.join(desktopRoot, 'src');
    const sources = collectSourceFiles(srcRoot);
    const offenders = sources.filter((file) => {
      const text = readFileSync(file, 'utf8');
      return /\bautoUpdater\b/.test(text);
    });
    expect(offenders).toEqual([]);
  });
});
