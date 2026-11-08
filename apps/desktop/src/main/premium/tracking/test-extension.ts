import { resolve } from 'node:path';

const SCRIPTS = resolve(__dirname, '../../../../scripts');

interface Fetcher {
  currentExtensionPlatform(): string | null;
  readDuckdbExtensionPin(platform: string): unknown;
  fetchDuckdbExtension(options: { pin: unknown; outDir: string }): Promise<string>;
}

async function fetcher(): Promise<Fetcher> {
  return (await import(/* @vite-ignore */ resolve(SCRIPTS, 'fetch-duckdb-extension.mjs'))) as Fetcher;
}

let cached: Promise<string> | null = null;

/**
 * Test-only. The signed extension for the platform the tests run on, downloaded once into a
 * gitignored build folder and checked against its pinned sha256. It throws when the download or the
 * check fails: a test that needs the extension must fail, never skip, when it is not there. A
 * platform with no pin fails the same way, naming itself: the repo's skip guard admits no new
 * conditional skips, and both Windows and Linux CI are pinned.
 */
export function currentPlatformExtension(): Promise<string> {
  cached ??= (async () => {
    const script = await fetcher();
    const platform = script.currentExtensionPlatform();
    if (platform === null) throw new Error(`No DuckDB extension is pinned for ${process.platform}/${process.arch}.`);
    return script.fetchDuckdbExtension({
      pin: script.readDuckdbExtensionPin(platform),
      outDir: resolve(SCRIPTS, '..', 'build', 'duckdb-test', platform),
    });
  })();
  return cached;
}
