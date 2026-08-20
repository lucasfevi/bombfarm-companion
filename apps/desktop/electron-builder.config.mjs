import { resolveBuildFlavor } from '@bombfarm/contracts';
import { createBuilderConfig } from './scripts/builder-config.mjs';

const flavor = resolveBuildFlavor(process.env.BFC_FLAVOR);

/** @type {import('electron-builder').Configuration} */
const config = createBuilderConfig(flavor);

export default config;
