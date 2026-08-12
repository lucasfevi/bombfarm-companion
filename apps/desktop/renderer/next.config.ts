import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Do not set distDir to `out` — that loops `next dev` (watcher sees its own writes).
  // Static export still lands in `out/` via `output: 'export'`.
  output: 'export',
  trailingSlash: true,
  assetPrefix: './',
  images: { unoptimized: true },
  transpilePackages: ['@bombfarm/ui', '@bombfarm/contracts', '@bombfarm/game-api', '@bombfarm/domain'],
};

export default nextConfig;
