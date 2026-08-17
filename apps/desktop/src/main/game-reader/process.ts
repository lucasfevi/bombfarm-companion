import { execSync } from 'node:child_process';

export function findProcessId(processName: string): number | null {
  const baseName = processName.replace(/\.exe$/i, '');
  try {
    const script = `(Get-Process -Name '${baseName}' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Id)`;
    const out = execSync(`powershell -NoProfile -Command "${script}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!out) return null;
    const pid = Number(out);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}
