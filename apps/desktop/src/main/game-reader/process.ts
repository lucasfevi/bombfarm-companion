import { execFile, execSync } from 'node:child_process';

export function stripExeSuffix(processName: string): string {
  return processName.replace(/\.exe$/i, '');
}

/** Synchronous — for call sites that run once per attach, not on a recurring poll. A synchronous
 *  PowerShell cold start (150-400ms) blocking Electron's single-threaded main process is only
 *  acceptable when it cannot recur every few seconds for the life of the app. */
export function runPowerShellSync(script: string): string {
  return execSync(`powershell -NoProfile -Command "${script}"`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

/** Never rejects: a spawn failure or non-zero exit resolves to `''`, the same "nothing found"
 *  shape a caller already has to handle for an empty stdout. */
export function runPowerShellAsync(script: string): Promise<string> {
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' }, (error, stdout) => {
      resolve(error ? '' : stdout.trim());
    });
  });
}

export function findProcessId(processName: string): number | null {
  const baseName = stripExeSuffix(processName);
  try {
    const script = `(Get-Process -Name '${baseName}' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Id)`;
    const out = runPowerShellSync(script);
    if (!out) return null;
    const pid = Number(out);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}
