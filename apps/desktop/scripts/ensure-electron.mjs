import { downloadArtifact } from '@electron/get';
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
  await extract(zip, { dir: dist });
  fs.writeFileSync(path.join(electronDir, 'path.txt'), path.basename(electronExe));
  fs.writeFileSync(path.join(dist, 'version'), version);
  console.log('Extracted Electron to', dist);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
