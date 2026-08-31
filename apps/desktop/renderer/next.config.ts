import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

const nextConfig: NextConfig = {
  // Do not set distDir to `out` — that loops `next dev` (watcher sees its own writes).
  // Static export still lands in `out/` via `output: 'export'`.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: [
    '@bombfarm/ui',
    '@bombfarm/contracts',
    '@bombfarm/game-api',
    '@bombfarm/domain',
    '@bombfarm/game-art',
    '@bombfarm/farm',
  ],
};

/**
 * Dev and build share no dist directory — see `apps/web/next.config.ts` for why. `pnpm build`
 * (and `pretest:smoke`, which runs one) reaches `next build renderer` while `pnpm dev` may
 * have `next dev renderer` up against the same tree.
 */
export default function config(phase: string): NextConfig {
  return phase === PHASE_DEVELOPMENT_SERVER ? { ...nextConfig, distDir: '.next-dev' } : nextConfig;
}
