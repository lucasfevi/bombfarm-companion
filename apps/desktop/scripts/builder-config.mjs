import { getFlavorDescriptor } from '@bombfarm/contracts';

export class InvalidVersionOverrideError extends Error {
  /**
   * @param {string} value
   */
  constructor(value) {
    super(`BFC_VERSION_OVERRIDE "${value}" is not valid semver`);
    this.name = 'InvalidVersionOverrideError';
  }
}

/**
 * @returns {string | undefined}
 */
function resolveVersionOverride() {
  const raw = process.env.BFC_VERSION_OVERRIDE;
  if (raw === undefined || raw === '') {
    return undefined;
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return undefined;
  }

  if (!isValidSemver(trimmed)) {
    throw new InvalidVersionOverrideError(trimmed);
  }

  return trimmed;
}

/**
 * @param {string} version
 * @returns {boolean}
 */
function isValidSemver(version) {
  return /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.test(version);
}

/**
 * @param {import('@bombfarm/contracts').AppFlavor} flavor
 * @returns {import('electron-builder').Configuration}
 */
export function createBuilderConfig(flavor) {
  const descriptor = getFlavorDescriptor(flavor);

  const publish = descriptor.updateChannel
    ? [{ provider: 'github', channel: descriptor.updateChannel }]
    : null;

  const versionOverride = resolveVersionOverride();
  const extraMetadata = {
    name: descriptor.packageName,
    bfcFlavor: flavor,
    ...(versionOverride === undefined ? {} : { version: versionOverride }),
  };

  return {
    appId: descriptor.appId,
    productName: descriptor.productName,
    directories: {
      output: descriptor.outputDir,
      buildResources: 'assets',
    },
    files: ['dist/**/*', 'renderer/out/**/*', 'package.json', '!**/*.map'],
    // frida ships one large prebuilt native addon (`frida_binding.node`), resolved at require()
    // time by walking real filesystem paths under its own package directory — dlopen cannot load
    // a `.node` file from inside app.asar, and the `bindings` package's own path search would not
    // find it there either. Unpacking the whole package (not just the `.node` file) keeps it and
    // its JS loader on the same real path electron-builder would otherwise split across the asar
    // boundary.
    asarUnpack: ['**/node_modules/frida/**/*'],
    extraMetadata,
    artifactName: '${name}-${version}-setup.${ext}',
    publish,
    generateUpdatesFilesForAllChannels: publish !== null,
    win: {
      target: [{ target: 'nsis', arch: ['x64'] }],
      icon: 'assets/icon.ico',
    },
    nsis: {
      oneClick: true,
      perMachine: false,
      allowToChangeInstallationDirectory: false,
    },
  };
}
