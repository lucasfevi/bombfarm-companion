import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CspManifestError, verifyManifestOnDisk, writeManifest } from './csp-manifest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'renderer', 'out');
const checkOnly = process.argv.includes('--check');

try {
  const manifest = checkOnly ? verifyManifestOnDisk(outDir) : writeManifest(outDir);
  const pageCount = Object.keys(manifest.pages).length;
  console.log(`Renderer CSP manifest ${checkOnly ? 'verified' : 'written'}: ${pageCount} pages`);
} catch (error) {
  if (error instanceof CspManifestError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
