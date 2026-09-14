import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * `Start.exe /box:<box> /listpids` prints the number of processes in the box on its first line and
 * then one pid per line.
 */
export function parseListPids(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+$/.test(line))
    .map(Number)
    .slice(1);
}

/**
 * `tasklist /FO CSV /NH /FI "IMAGENAME eq <image>"` prints one quoted CSV row per process — image
 * name first, pid second — and, when nothing matches, an unquoted `INFO:` sentence instead.
 */
export function parseTasklistPids(output) {
  const pids = [];
  for (const line of output.split(/\r?\n/)) {
    const match = /^"[^"]*","(\d+)"/.exec(line.trim());
    if (match) pids.push(Number(match[1]));
  }
  return pids;
}

export function boxedProcessIds(startExe, box) {
  return parseListPids(execFileSync(startExe, [`/box:${box}`, '/listpids'], { encoding: 'utf8' }));
}

export function processIdsOfImage(imageName) {
  return parseTasklistPids(
    execFileSync('tasklist', ['/FO', 'CSV', '/NH', '/FI', `IMAGENAME eq ${imageName}`], { encoding: 'utf8' }),
  );
}

/** The pids running `image` that are inside the box: every process of the boxed Electron tree. */
export function boxedElectronPids({ inBox, runningImage }) {
  const boxed = new Set(inBox);
  return runningImage.filter((pid) => boxed.has(pid));
}

/**
 * Closes the boxed Electron from the host and returns the pids it terminated. Killing the
 * launcher's own child does not do it: the host `Start.exe` hands the program to a second,
 * boxed `Start.exe` owned by the Sandboxie service, so the boxed tree is never a descendant of
 * the launcher — but a plain host-side kill by pid reaches inside the box.
 */
export function terminateBoxedElectron({ startExe, box, electronBin, kill = (pid) => process.kill(pid) }) {
  const targets = boxedElectronPids({
    inBox: boxedProcessIds(startExe, box),
    runningImage: processIdsOfImage(path.basename(electronBin)),
  });
  for (const pid of targets) {
    try {
      kill(pid);
    } catch {
      // already gone
    }
  }
  return targets;
}
