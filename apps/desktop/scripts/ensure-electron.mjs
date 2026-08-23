import { downloadArtifact } from '@electron/get';
import extract from 'extract-zip';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..');
const electronDir = path.join(desktopRoot, 'node_modules', 'electron');
const version = JSON.parse(
  fs.readFileSync(path.join(electronDir, 'package.json'), 'utf8'),
).version;
const dist = path.join(electronDir, 'dist');
const electronExe = path.join(dist, process.platform === 'win32' ? 'electron.exe' : 'electron');

// A ~150MB download unpacking to ~250MB on a slow disk can legitimately take minutes; this only
// needs to be well above that so a real stall still fails in reasonable time.
export const EXTRACTION_TIMEOUT_MS = 5 * 60 * 1000;

export class ElectronExtractionTimeoutError extends Error {
  constructor(timeoutMs, zip, targetDir) {
    super(
      `Electron extraction did not finish within ${timeoutMs}ms.\n` +
        `Zip: ${zip}\nTarget: ${targetDir}\n` +
        'Delete node_modules/electron/dist and re-run.',
    );
    this.name = 'ElectronExtractionTimeoutError';
  }
}

export class ElectronBinaryMissingAfterExtractError extends Error {
  constructor(expectedExePath, zip) {
    super(
      `Expected ${expectedExePath} to exist after extracting ${zip}, but it does not.\n` +
        'Delete node_modules/electron/dist and re-run.',
    );
    this.name = 'ElectronBinaryMissingAfterExtractError';
  }
}

export async function extractElectronBinary({
  zip,
  dist: targetDir,
  electronExe: expectedExePath,
  extractFn = extract,
  exists = fs.existsSync,
  timeoutMs = EXTRACTION_TIMEOUT_MS,
}) {
  let timer;
  // extract-zip can neither resolve nor reject on the large electron.exe entry; racing it
  // against a timer that rejects is what stops a stalled run from exiting 0 with nothing
  // extracted, since an unsettled promise alone leaves nothing to keep the event loop alive.
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new ElectronExtractionTimeoutError(timeoutMs, zip, targetDir));
    }, timeoutMs);
  });

  try {
    await Promise.race([extractFn(zip, { dir: targetDir }), timeout]);
  } finally {
    clearTimeout(timer);
  }

  if (!exists(expectedExePath)) {
    throw new ElectronBinaryMissingAfterExtractError(expectedExePath, zip);
  }
}

async function main() {
  if (fs.existsSync(electronExe)) {
    console.log('Electron binary already present:', electronExe);
    return;
  }

  console.log('Downloading Electron', version);
  const zip = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform: process.platform === 'win32' ? 'win32' : process.platform,
    arch: process.arch,
  });
  console.log('Zip:', zip);

  fs.mkdirSync(dist, { recursive: true });
  await extractElectronBinary({ zip, dist, electronExe });

  fs.writeFileSync(path.join(electronDir, 'path.txt'), path.basename(electronExe));
  fs.writeFileSync(path.join(dist, 'version'), version);
  console.log('Extracted Electron to', dist);
}

const isMainModule = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
