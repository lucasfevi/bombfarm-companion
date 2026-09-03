import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';
import type { Configuration as WebpackConfig } from 'webpack';
import { cappedWorkers } from '../../tools/cpu-budget.mjs';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const webPackage = JSON.parse(
  readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
) as { version: string };
/** Monorepo root — pnpm hoists `next` here; Turbopack must resolve from this tree. */
const monorepoRoot = path.resolve(projectRoot, '../..');

/**
 * Dev HMR is fragile on Windows when agents (or editors) write many files in a
 * burst. Next webpack's default watch aggregateTimeout is 5ms, which lets
 * overlapping Fast Refresh applies corrupt the module graph
 * (`__webpack_modules__[moduleId] is not a function`).
 *
 * Prefer Turbopack for `pnpm dev` (see package.json) — it uses a different HMR
 * path. Keep these webpack watch guards for `pnpm dev:webpack`.
 *
 * Ignore specs, e2e, Storybook, tests, and build artifacts that agents touch
 * constantly but never belong in the Next module graph.
 */
const DEV_WATCH_IGNORED = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.next/**',
  '**/.next-dev/**',
  '**/.storybook/**',
  '**/e2e/perf/out/**',
  '**/e2e/**',
  '**/storybook-static/**',
  '**/test-results/**',
  '**/playwright-report/**',
  '**/coverage/**',
  '**/out/**',
  '**/src/**/__tests__/**',
  '**/src/tests/**',
  '**/src/**/*.test.ts',
  '**/src/**/*.test.tsx',
  '**/src/**/*.stories.ts',
  '**/src/**/*.stories.tsx',
] as const;

/**
 * Set by `pnpm perf:build:profile` to produce a *measurement* build: production
 * React (via `next build --profile`) with component names retained. Off for every normal
 * build, so shipped output is unaffected.
 */
const PERF_PROFILE = process.env.PERF_PROFILE === '1';

/**
 * Cap on Next's build/export worker pool — the same discipline as the Vitest cap in
 * `vitest.workers.ts` and the Playwright cap in `playwright.config.ts`.
 *
 * Next defaults `experimental.cpus` to `os.cpus().length - 1` (see
 * `next/dist/server/config-shared.js`), so on a 24-core dev machine a plain
 * `next build` fans out to **23** worker processes for static page generation.
 * With `output: 'export'` plus the React Compiler babel pass, that pegs every core
 * for the whole build and makes the machine unusable while it runs.
 *
 * This app exports a small number of routes, so the pool is nowhere near the
 * bottleneck — page generation is not what makes the build long. Capping trades
 * little or no wall time for leaving the machine usable.
 *
 * CI is unaffected in practice: GitHub-hosted runners report 2–4 cores, so the
 * `min` already resolves below the cap there.
 *
 * `cappedWorkers` lowers this further while other Bomb Farm runs are executing — the pool
 * above bounds one build, not the machine, and several builds at once each took it whole.
 * See `tools/cpu-budget.mjs`; it is a no-op for a build that has the machine to itself.
 */
const BUILD_WORKERS = cappedWorkers(Math.min(4, availableParallelism() - 1), 'next:build');

const nextConfig: NextConfig = {
  // Client-only planner (localStorage). Ready for Vercel; no Node runtime needed.
  output: 'export',
  env: {
    NEXT_PUBLIC_APP_VERSION: webPackage.version,
    NEXT_PUBLIC_APP_IS_PRODUCTION: String(process.env.VERCEL_ENV === 'production'),
    NEXT_PUBLIC_APP_COMMIT_SHA:
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? '',
    NEXT_PUBLIC_APP_VERSION_LABEL_OVERRIDE: process.env.BFC_VERSION_LABEL_OVERRIDE ?? '',
  },
  reactStrictMode: true,
  transpilePackages: [
    '@bombfarm/account',
    '@bombfarm/domain',
    '@bombfarm/ui',
    '@bombfarm/game-art',
    '@bombfarm/farm',
  ],
  // Pin Turbopack's resolve root to the pnpm workspace root.
  // apps/web alone breaks when `next` is hoisted to the repo root (`Next.js package not found`).
  turbopack: {
    root: monorepoRoot,
  },
  // React 19 — babel-plugin-react-compiler; no react-compiler-runtime / target 18.
  // Next 15.5 still nests this under experimental (top-level key is unrecognized).
  experimental: {
    // See BUILD_WORKERS above — bounds the static-export worker pool, which
    // otherwise scales to `cores - 1`.
    cpus: BUILD_WORKERS,
    reactCompiler: true,
    // Segment explorer wraps every App Router segment with SegmentViewNode in
    // the RSC payload. After bursty HMR that wrapper often drops out of the
    // React Client Manifest and hard-crashes the page until `pnpm dev` restart.
    // Disable until Next's HMR/manifest race is more stable on Windows.
    devtoolSegmentExplorer: false,
  },
  webpack: (config: WebpackConfig, { dev }) => {
    if (!dev && PERF_PROFILE) {
      // Perf-measurement build only, never a shipped artifact.
      //
      // `next build --profile` swaps in React's profiling build so the Profiler API
      // reports in production, but it does not stop SWC mangling function names — and
      // the perf harness keys every row on `componentKey`, i.e. the component's name.
      // That is exactly why W1's spike rejected production-profile and locked the
      // baseline to `dev-strict`, which measures dev + StrictMode double-invoke rather
      // than production.
      //
      // Disabling minification is what actually retains the names. It changes bundle
      // size and parse time, but not React's runtime semantics: this is still the
      // production React build, with no dev warnings and no StrictMode double-render.
      // Render counts and commit durations are therefore representative in a way
      // `dev-strict` can never be. Never use this build to judge bundle size — that is
      // what `bundle-delta.md` and a normal `pnpm build` are for.
      config.optimization = { ...config.optimization, minimize: false };
    }
    if (!dev) {
      // Keep zustand's `devtools` middleware out of the production bundle.
      // The runtime `NODE_ENV` guard is not enough on its own: webpack marks a
      // statically-imported binding as used at module-graph time, so the middleware
      // ships whole even though the branch using it is provably dead. Measured leak:
      // 1,517 B gzip. Swapping the module is the only reliable fix.
      // Guarded by src/tests/devtools-not-in-production-bundle.test.ts.
      config.resolve = config.resolve ?? {};
      config.resolve.alias = {
        ...config.resolve.alias,
        [path.resolve(projectRoot, 'src/shared/stores/devtools-middleware.ts')]: path.resolve(
          projectRoot,
          'src/shared/stores/devtools-middleware-noop.ts',
        ),
      };
    }
    if (dev) {
      // Stale filesystem cache + HMR swaps is a common source of moduleId
      // mismatches on Windows after rapid multi-file edits.
      config.cache = false;
      config.watchOptions = {
        ...config.watchOptions,
        aggregateTimeout: 1000,
        ignored: [...DEV_WATCH_IGNORED],
      };
    }
    return config;
  },
};

/**
 * `next dev` and `next build` write mutually incompatible trees, and `next build` wipes the
 * whole dist directory before it writes. Under the default shared `.next` the two collide on
 * the same paths — dev keeps `server/pages/_app/build-manifest.json` (a directory per entry),
 * build writes `server/pages/_app.js` (a file). A build therefore deletes the manifests the
 * running dev server holds open, and every later Fast Refresh dies with
 * `ENOENT ... .next/server/pages/_app/build-manifest.json` until the server is restarted.
 *
 * That is routine here, not misuse: `pnpm build` is the documented first step of any session
 * (see AGENTS.md), so it lands while a dev server is up whenever both run against one tree.
 * Giving dev its own dist directory makes the two disjoint.
 */
export default function config(phase: string): NextConfig {
  return phase === PHASE_DEVELOPMENT_SERVER ? { ...nextConfig, distDir: '.next-dev' } : nextConfig;
}
