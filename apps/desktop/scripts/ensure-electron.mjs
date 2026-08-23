import { downloadArtifact } from '@electron/get';
import { spawn } from 'node:child_process';
import extract from 'extract-zip';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

export function resolveSystemTarPath() {
  if (process.platform === 'win32') {
    return path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
  }
  return 'tar';
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

// GNU tar cannot read zip archives, so "a tar exists" isn't enough — detection must
// confirm the bsdtar/libarchive build specifically before trusting it with the zip.
export function isLibarchiveTar(versionOutput) {
  return /bsdtar|libarchive/i.test(versionOutput);
}

export async function probeTarVersion(tarPath) {
  const { code, stdout, stderr } = await runProcess(tarPath, ['--version']);
  if (code !== 0) {
    throw new Error(`${tarPath} --version exited with code ${code}`);
  }
  return `${stdout}\n${stderr}`;
}

export async function extractWithOsTar({ tarPath, zip, dist: targetDir }) {
  const { code, stderr } = await runProcess(tarPath, ['-xf', zip, '-C', targetDir]);
  if (code !== 0) {
    throw new Error(`${tarPath} extraction exited with code ${code}: ${stderr}`);
  }
}

export async function extractElectronBinary({
  zip,
  dist: targetDir,
  electronExe: expectedExePath,
  extractFn = extract,
  exists = fs.existsSync,
  timeoutMs = EXTRACTION_TIMEOUT_MS,
  tarPath,
  probeTar,
  extractWithTar = extractWithOsTar,
}) {
  let timer;
  // extract-zip can neither resolve nor reject on the large electron.exe entry; racing it
  // against a timer that rejects is what stops a stalled run from exiting 0 with nothing
  // extracted, since an unsettled promise alone leaves nothing to keep the event loop alive.
  // Whichever extraction path runs below — OS tar or extract-zip — is raced the same way.
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new ElectronExtractionTimeoutError(timeoutMs, zip, targetDir));
    }, timeoutMs);
  });

  const runExtraction = async () => {
    if (tarPath && probeTar) {
      try {
        const versionOutput = await probeTar(tarPath);
        if (isLibarchiveTar(versionOutput)) {
          try {
            console.log('Extracting Electron with system tar:', tarPath);
            await extractWithTar({ tarPath, zip, dist: targetDir });
            return;
          } catch (error) {
            console.warn('System tar extraction failed, falling back to extract-zip:', error);
          }
        } else {
          console.log('System tar is not libarchive-based; using extract-zip.');
        }
      } catch (error) {
        console.log('System tar unavailable, using extract-zip:', error.message);
      }
    }

    console.log('Extracting Electron with extract-zip.');
    await extractFn(zip, { dir: targetDir });
  };

  try {
    await Promise.race([runExtraction(), timeout]);
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
  await extractElectronBinary({
    zip,
    dist,
    electronExe,
    tarPath: resolveSystemTarPath(),
    probeTar: probeTarVersion,
    extractWithTar: extractWithOsTar,
  });

  fs.writeFileSync(path.join(electronDir, 'path.txt'), path.basename(electronExe));
  fs.writeFileSync(path.join(dist, 'version'), version);
  console.log('Extracted Electron to', dist);
}

/**
 * Raw URL string comparison (`import.meta.url === pathToFileURL(argv[1]).href`) can go false
 * for the same file — a symlinked checkout, or a Windows drive-letter case mismatch — which
 * would skip `main()` silently and exit 0 with nothing downloaded. Comparing `realpathSync`
 * output instead is robust to that; a mismatch that's still worth a stderr line (as opposed to
 * a plain `import` with no `argv[1]` at all, which is legitimate and stays silent) means this
 * script loaded but did not run as the entry point.
 */
export function isRunAsEntryPoint({
  importMetaUrl,
  argv1,
  realpathSync = fs.realpathSync,
  onSkippedEntryPoint = (message) => console.error(message),
} = {}) {
  if (!argv1) return false;

  const modulePath = realpathSync(fileURLToPath(importMetaUrl));
  let entryPath;
  try {
    entryPath = realpathSync(argv1);
  } catch {
    entryPath = path.resolve(argv1);
  }

  if (modulePath === entryPath) return true;

  onSkippedEntryPoint(
    `ensure-electron.mjs was loaded but did not run as the entry point (module: ${modulePath}, argv[1]: ${entryPath}) — skipping main().`,
  );
  return false;
}

const isMainModule = isRunAsEntryPoint({ importMetaUrl: import.meta.url, argv1: process.argv[1] });
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
