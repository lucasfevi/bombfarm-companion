import { describe, expect, it } from 'vitest';
import {
  APP_FLAVORS,
  FLAVORS,
  InvalidFlavorError,
  getFlavorDescriptor,
  isAppFlavor,
  parseFlavorToken,
  resolveBuildFlavor,
  resolveRuntimeFlavor,
  type AppFlavor,
} from './flavors.js';

const MATRIX: Record<
  AppFlavor,
  {
    appId: string;
    productName: string;
    badgeLabel: string | null;
    dataDirName: string;
    packageName: string;
    outputDir: string;
    updateChannel: string | null;
    consoleLogLevel: 'debug' | false;
    fileLogLevel: 'debug' | 'info';
  }
> = {
  dev: {
    appId: 'net.bombfarm.companion.dev',
    productName: 'Bomb Farm Companion (Dev)',
    badgeLabel: 'DEV',
    dataDirName: 'Bomb Farm Companion (Dev)',
    packageName: 'bombfarm-companion-dev',
    outputDir: 'release/dev',
    updateChannel: null,
    consoleLogLevel: 'debug',
    fileLogLevel: 'debug',
  },
  beta: {
    appId: 'net.bombfarm.companion.beta',
    productName: 'Bomb Farm Companion (Beta)',
    badgeLabel: 'BETA',
    dataDirName: 'Bomb Farm Companion (Beta)',
    packageName: 'bombfarm-companion-beta',
    outputDir: 'release/beta',
    updateChannel: 'beta',
    consoleLogLevel: false,
    fileLogLevel: 'info',
  },
  prod: {
    appId: 'net.bombfarm.companion',
    productName: 'Bomb Farm Companion',
    badgeLabel: null,
    dataDirName: 'Bomb Farm Companion',
    packageName: 'bombfarm-companion',
    outputDir: 'release/prod',
    updateChannel: 'latest',
    consoleLogLevel: false,
    fileLogLevel: 'info',
  },
};

describe('APP_FLAVORS', () => {
  it('lists the closed three-token set', () => {
    expect(APP_FLAVORS).toEqual(['dev', 'beta', 'prod']);
  });
});

describe('FLAVORS matrix', () => {
  for (const flavor of APP_FLAVORS) {
    it(`pins every matrix column for ${flavor}`, () => {
      const descriptor = FLAVORS[flavor];
      const expected = MATRIX[flavor];

      expect(descriptor.appId).toBe(expected.appId);
      expect(descriptor.productName).toBe(expected.productName);
      expect(descriptor.badgeLabel).toBe(expected.badgeLabel);
      expect(descriptor.dataDirName).toBe(expected.dataDirName);
      expect(descriptor.dataDirName).toBe(descriptor.productName);
      expect(descriptor.packageName).toBe(expected.packageName);
      expect(descriptor.outputDir).toBe(expected.outputDir);
      expect(descriptor.updateChannel).toBe(expected.updateChannel);
      expect(descriptor.logLevel.console).toBe(expected.consoleLogLevel);
      expect(descriptor.logLevel.file).toBe(expected.fileLogLevel);
    });
  }
});

describe('getFlavorDescriptor', () => {
  it('returns the same row as FLAVORS', () => {
    expect(getFlavorDescriptor('beta')).toBe(FLAVORS.beta);
  });
});

describe('isAppFlavor', () => {
  it('accepts only the three tokens', () => {
    expect(isAppFlavor('dev')).toBe(true);
    expect(isAppFlavor('beta')).toBe(true);
    expect(isAppFlavor('prod')).toBe(true);
    expect(isAppFlavor('nightly')).toBe(false);
    expect(isAppFlavor('beeta')).toBe(false);
    expect(isAppFlavor('production')).toBe(false);
    expect(isAppFlavor(null)).toBe(false);
  });
});

describe('parseFlavorToken', () => {
  it('trim and lower-case before matching', () => {
    expect(parseFlavorToken(' PROD ')).toBe('prod');
    expect(parseFlavorToken(' BETA ')).toBe('beta');
  });

  it('returns null for unset, empty, and unlisted tokens', () => {
    expect(parseFlavorToken(undefined)).toBeNull();
    expect(parseFlavorToken(null)).toBeNull();
    expect(parseFlavorToken('')).toBeNull();
    expect(parseFlavorToken('   ')).toBeNull();
    expect(parseFlavorToken('beeta')).toBeNull();
    expect(parseFlavorToken('production')).toBeNull();
    expect(parseFlavorToken('nightly')).toBeNull();
  });
});

describe('resolveBuildFlavor', () => {
  it('resolves valid tokens', () => {
    expect(resolveBuildFlavor('beta')).toBe('beta');
    expect(resolveBuildFlavor(' PROD ')).toBe('prod');
  });

  it('throws for unset, empty, and unlisted values', () => {
    expect(() => resolveBuildFlavor(undefined)).toThrow(InvalidFlavorError);
    expect(() => resolveBuildFlavor('')).toThrow(InvalidFlavorError);
    expect(() => resolveBuildFlavor('beeta')).toThrow(InvalidFlavorError);
    expect(() => resolveBuildFlavor('production')).toThrow(InvalidFlavorError);
    expect(() => resolveBuildFlavor('nightly')).toThrow(InvalidFlavorError);
  });

  it('names the rejected value in build errors', () => {
    expect(() => resolveBuildFlavor('beeta')).toThrow(/beeta/);
    expect(() => resolveBuildFlavor(undefined)).toThrow(/unset/);
  });
});

describe('resolveRuntimeFlavor', () => {
  it('defaults unpackaged unset or empty to dev', () => {
    expect(resolveRuntimeFlavor({ raw: undefined, isPackaged: false, bakedFlavor: null })).toEqual({
      flavor: 'dev',
      envConflict: null,
    });
    expect(resolveRuntimeFlavor({ raw: '', isPackaged: false, bakedFlavor: null })).toEqual({
      flavor: 'dev',
      envConflict: null,
    });
    expect(resolveRuntimeFlavor({ raw: '   ', isPackaged: false, bakedFlavor: null })).toEqual({
      flavor: 'dev',
      envConflict: null,
    });
  });

  it('resolves trimmed unpackaged tokens', () => {
    expect(resolveRuntimeFlavor({ raw: ' BETA ', isPackaged: false, bakedFlavor: null })).toEqual({
      flavor: 'beta',
      envConflict: null,
    });
  });

  it('throws for unpackaged unlisted tokens naming the rejected value', () => {
    expect(() =>
      resolveRuntimeFlavor({ raw: 'beeta', isPackaged: false, bakedFlavor: null }),
    ).toThrow(/beeta/);
    expect(() =>
      resolveRuntimeFlavor({ raw: 'production', isPackaged: false, bakedFlavor: null }),
    ).toThrow(/production/);
  });

  it('uses the baked stamp for packaged builds with unset env', () => {
    expect(
      resolveRuntimeFlavor({ raw: undefined, isPackaged: true, bakedFlavor: 'prod' }),
    ).toEqual({
      flavor: 'prod',
      envConflict: null,
    });
  });

  it('reports env conflict when packaged env requests a different valid flavor', () => {
    expect(
      resolveRuntimeFlavor({ raw: 'beta', isPackaged: true, bakedFlavor: 'prod' }),
    ).toEqual({
      flavor: 'prod',
      envConflict: { requested: 'beta', effective: 'prod' },
    });
  });

  it('throws for packaged unlisted env tokens naming the rejected value', () => {
    expect(() =>
      resolveRuntimeFlavor({ raw: 'beeta', isPackaged: true, bakedFlavor: 'prod' }),
    ).toThrow(/beeta/);
    expect(() =>
      resolveRuntimeFlavor({ raw: 'production', isPackaged: true, bakedFlavor: 'beta' }),
    ).toThrow(/production/);
  });

  it('throws when packaged stamp is missing or invalid', () => {
    expect(() =>
      resolveRuntimeFlavor({ raw: undefined, isPackaged: true, bakedFlavor: null }),
    ).toThrow(InvalidFlavorError);
    expect(() =>
      resolveRuntimeFlavor({ raw: undefined, isPackaged: true, bakedFlavor: 'beeta' as AppFlavor }),
    ).toThrow(InvalidFlavorError);
  });
});
