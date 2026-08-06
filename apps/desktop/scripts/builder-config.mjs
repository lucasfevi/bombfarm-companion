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
    extraMetadata,
    artifactName: '${name}-${version}-setup.${ext}',
    publish,
    generateUpdatesFilesForAllChannels: publish !== null,
    win: {
      target: [{ target: 'nsis', arch: ['x64'] }],
    },
    nsis: {
      oneClick: true,
      perMachine: false,
      allowToChangeInstallationDirectory: false,
    },
  };
}
