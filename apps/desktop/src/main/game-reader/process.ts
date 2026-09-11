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

/** Where a process lookup runs. `isPackaged` defaults to `true` — the direction in which an
 *  omitted argument costs a developer a flag rather than pinning an installed app. */
export interface ProcessLookupContext {
  readonly env?: NodeJS.ProcessEnv;
  readonly isPackaged?: boolean;
}

/**
 * `BFC_GAME_PID` pins every lookup to one process, for a machine running more than one instance
 * of the game — without it each lookup takes the first process carrying the game's name, which
 * is whichever instance launched first. Absent or blank means no pin. A value that is not a
 * positive integer throws rather than being ignored, because ignoring it would silently attach
 * to the wrong instance, the exact failure the variable exists to prevent.
 *
 * A packaged app never pins: like the fixture reader and the user-data override, the variable is
 * honoured only when `isPackaged === false`, so an installed build cannot be redirected by a
 * value left in someone's environment.
 */
export function pinnedGamePid(context: ProcessLookupContext = {}): number | null {
  if (context.isPackaged ?? true) return null;
  const raw = (context.env ?? process.env).BFC_GAME_PID?.trim();
  if (raw === undefined || raw === '') return null;
  if (!/^[1-9][0-9]*$/.test(raw)) {
    throw new Error(`BFC_GAME_PID must be a positive integer, got "${raw}"`);
  }
  return Number(raw);
}

/**
 * The one PowerShell expression every process lookup starts from: the game's processes by name,
 * narrowed to the pinned pid when there is one. Callers append their own `Select-Object`.
 */
export function gameProcessQuery(processName: string, context: ProcessLookupContext = {}): string {
  const baseName = stripExeSuffix(processName);
  const byName = `Get-Process -Name '${baseName}' -ErrorAction SilentlyContinue`;
  const pid = pinnedGamePid(context);
  return pid === null ? byName : `${byName} | Where-Object { $_.Id -eq ${String(pid)} }`;
}

function findProcessIdScript(processName: string, context: ProcessLookupContext): string {
  return `(${gameProcessQuery(processName, context)} | Select-Object -First 1 -ExpandProperty Id)`;
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
export async function findProcessIdAsync(
  processName: string,
  context: ProcessLookupContext = {},
): Promise<number | null> {
  return parseProcessId(await runPowerShellAsync(findProcessIdScript(processName, context)));
}

