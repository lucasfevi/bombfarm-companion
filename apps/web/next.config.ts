import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  transpilePackages: ['@bombfarm/domain', '@bombfarm/ui'],
};

export default nextConfig;
