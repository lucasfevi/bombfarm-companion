import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

const nextConfig: NextConfig = {
  // Do not set distDir to `out` — that loops `next dev` (watcher sees its own writes).
  // Static export still lands in `out/` via `output: 'export'`.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // `scripts/dev.mjs` points Electron at `http://127.0.0.1:<port>` while `next dev` identifies
  // itself as `localhost`, so without this every `/_next/*` request is flagged cross-origin.
  allowedDevOrigins: ['127.0.0.1'],
  transpilePackages: [
    '@bombfarm/account',
    '@bombfarm/ui',
    '@bombfarm/contracts',
    '@bombfarm/game-api',
    '@bombfarm/domain',
    '@bombfarm/game-art',
    '@bombfarm/farm',
    '@bombfarm/hero',
    '@bombfarm/team-plan',
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
