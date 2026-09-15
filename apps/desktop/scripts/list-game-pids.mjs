import { execFile } from 'node:child_process';
import process from 'node:process';

/**
 * `pnpm dev:pids` — the running instances of the game, one row each, so a `pnpm dev --pid <n>`
 * can name the one to attach to. Same lookup the app itself makes (`Get-Process` by name), with
 * the start time and window title added because a pid alone does not say which instance is which.
 */
const processName = (process.env.BFC_GAME_PROCESS ?? 'BombFarm.exe').replace(/\.exe$/i, '');

const script = [
  `Get-Process -Name '${processName}' -ErrorAction SilentlyContinue`,
  'Select-Object Id,StartTime,MainWindowTitle,Path',
  'ConvertTo-Json -Compress',
].join(' | ');

execFile('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' }, (error, stdout) => {
  if (error) {
    console.error(`Could not list processes: ${error.message}`);
    process.exit(1);
  }
  const out = stdout.trim();
  if (!out) {
    console.log(`No running process named ${processName}.`);
    return;
  }
  const parsed = JSON.parse(out);
  const rows = (Array.isArray(parsed) ? parsed : [parsed]).sort((a, b) => Number(a.Id) - Number(b.Id));

  console.log(`${rows.length} running instance(s) of ${processName}, lowest pid first — that is the one the app attaches to without --pid:\n`);
  console.table(
    rows.map((row) => ({
      pid: Number(row.Id),
      started: startedAt(row.StartTime),
      window: row.MainWindowTitle || '',
      path: row.Path || '',
    })),
  );
  console.log('\nAttach to one with:  pnpm dev --pid <pid>');
});

/** `ConvertTo-Json` writes a DateTime as `/Date(<ms>)/`; anything else is shown as it came. */
function startedAt(value) {
  if (typeof value !== 'string') return '';
  const match = /\/Date\((\d+)\)\//.exec(value);
  return match ? new Date(Number(match[1])).toLocaleString() : value;
}
