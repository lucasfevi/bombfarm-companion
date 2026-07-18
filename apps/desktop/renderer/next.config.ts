import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'out',
  trailingSlash: true,
  assetPrefix: './',
  images: { unoptimized: true },
  transpilePackages: ['@bombfarm/ui', '@bombfarm/contracts'],
};

export default nextConfig;
