import { fetchDuckdbExtension } from '../../scripts/fetch-duckdb-extension.mjs';

/**
 * The tracking store opens its database only with DuckDB's signed extension, which the build does
 * not fetch. Playwright runs this once before any spec: a file already in `build/duckdb` with the
 * pinned checksum is kept (no network), anything else is downloaded and verified. A failed fetch
 * throws, which fails the whole run - a smoke that needs the extension never skips without it.
 */
export default async function globalSetup() {
  const file = await fetchDuckdbExtension();
  console.log(`DuckDB extension ready: ${file}`);
}
