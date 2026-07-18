import path from 'node:path';

const flavor = process.env.BFC_FLAVOR === 'dev' ? 'dev' : 'prod';
const isDevFlavor = flavor === 'dev';

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: isDevFlavor ? 'net.bombfarm.companion.dev' : 'net.bombfarm.companion',
  productName: isDevFlavor ? 'Bomb Farm Companion (DEV)' : 'Bomb Farm Companion',
  directories: {
    output: path.join('release', flavor),
    buildResources: 'assets',
  },
  files: ['dist/**/*', 'renderer/out/**/*', 'package.json', '!**/*.map'],
  extraMetadata: {
    name: isDevFlavor ? 'bombfarm-companion-dev' : 'bombfarm-companion',
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    allowToChangeInstallationDirectory: false,
  },
};

export default config;
