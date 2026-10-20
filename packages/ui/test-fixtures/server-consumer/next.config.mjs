import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cappedWorkers } from '../../../../tools/cpu-budget.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

export default {
  transpilePackages: ['@bombfarm/ui'],
  outputFileTracingRoot: path.resolve(here, '../../../..'),
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  experimental: { cpus: cappedWorkers(2, 'next:build'), optimizePackageImports: ['@bombfarm/ui'] },
};
