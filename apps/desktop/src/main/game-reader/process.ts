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

/**
 * Whether a pid we already hold is still a running process. A signal of `0` sends nothing — it
 * only asks the kernel whether the target exists — so this is a syscall measured in microseconds,
 * against the ~166ms a PowerShell cold start costs to answer the same question. `EPERM` means the
 * process is there and simply not ours to signal, which is a yes.
 *
 * It cannot tell one process from another, so it is a fast path for "the pid I found is still
 * alive", never a substitute for finding it in the first place.
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function parseProcessId(out: string): number | null {
  if (!out) return null;
  const pid = Number(out);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

function findProcessIdScript(processName: string): string {
  const baseName = stripExeSuffix(processName);
  return `(Get-Process -Name '${baseName}' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Id)`;
}

/**
 * The only form any recurring caller may use. The lookup itself is unavoidably a PowerShell cold
 * start (~166ms); what matters is that the main process is free for all of it rather than stopped
 * inside it, because the window message loop — and so any window being dragged — runs on that
 * thread.
 *
 * Never rejects: {@link runPowerShellAsync} resolves to `''` on a spawn failure or non-zero exit,
 * which parses to `null` — the same "nothing found" every caller already handles.
 */
export async function findProcessIdAsync(processName: string): Promise<number | null> {
  return parseProcessId(await runPowerShellAsync(findProcessIdScript(processName)));
}

