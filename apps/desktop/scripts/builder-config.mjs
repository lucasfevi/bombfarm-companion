import { getFlavorDescriptor } from '@bombfarm/contracts';

/**
 * @param {import('@bombfarm/contracts').AppFlavor} flavor
 * @returns {import('electron-builder').Configuration}
 */
export function createBuilderConfig(flavor) {
  const descriptor = getFlavorDescriptor(flavor);

  const publish = descriptor.updateChannel
    ? [{ provider: 'github', channel: descriptor.updateChannel }]
    : null;

  return {
    appId: descriptor.appId,
    productName: descriptor.productName,
    directories: {
      output: descriptor.outputDir,
      buildResources: 'assets',
    },
    files: ['dist/**/*', 'renderer/out/**/*', 'package.json', '!**/*.map'],
    extraMetadata: {
      name: descriptor.packageName,
      bfcFlavor: flavor,
    },
    artifactName: '${name}-${version}-setup.${ext}',
    publish,
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
