import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import process from 'node:process';
import { parseFlavorToken } from '@bombfarm/contracts';
import { findFreePort } from './dev-port.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..');
const PREFERRED_PORT = Number(process.env.BFC_RENDERER_PORT ?? 3000);

/** Spawn without `shell: true` so paths with spaces (e.g. `Lucas Vieira`) stay intact. */
function run(command, args, options = {}) {
  return spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });
}

function waitForPort(port, timeoutMs = 60_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ port, host: '127.0.0.1' }, () => {
        socket.end();
        resolve(undefined);
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for port ${port}`));
          return;
        }
        setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

// Dev launcher defaults unpackaged runs to dev; any other token must be valid.
const rawFlavor = process.env.BFC_FLAVOR;
const parsedFlavor = parseFlavorToken(rawFlavor);
/** @type {import('@bombfarm/contracts').AppFlavor} */
let flavor;
if (parsedFlavor !== null) {
  flavor = parsedFlavor;
} else if (rawFlavor === undefined || rawFlavor.trim() === '') {
  flavor = 'dev';
} else {
  console.error(`Invalid BFC_FLAVOR: ${rawFlavor.trim()}`);
  process.exit(1);
}

/**
 * `--pid <n>` attaches the app to one instance of the game when several are running; without it
 * the app takes whichever instance launched first. `pnpm dev:pids` lists the candidates. The
 * flag BEATS a `BFC_GAME_PID` already in the environment — a pid left set in a PowerShell session
 * from an earlier run belongs to a process that no longer exists, and must not quietly win over
 * the one typed into this command. An unusable value exits rather than falling back to "any
 * instance", which is the failure the flag exists to prevent.
 */
function pinnedPidFromArgv(argv) {
  const index = argv.findIndex((arg) => arg === '--pid' || arg.startsWith('--pid='));
  if (index === -1) return null;
  const arg = argv[index];
  const raw = arg.startsWith('--pid=') ? arg.slice('--pid='.length) : argv[index + 1];
  if (raw === undefined || raw.startsWith('--')) {
    console.error('dev --pid needs a process id, e.g. --pid 12345. `pnpm dev:pids` lists the running instances.');
    process.exit(1);
  }
  if (!/^[1-9][0-9]*$/.test(raw)) {
    console.error(`dev --pid needs a positive integer, got "${raw}". \`pnpm dev:pids\` lists the running instances.`);
    process.exit(1);
  }
  return raw;
}

const pinnedPid = pinnedPidFromArgv(process.argv);
if (pinnedPid !== null) {
  const displaced = process.env.BFC_GAME_PID;
  process.env.BFC_GAME_PID = pinnedPid;
  if (displaced !== undefined && displaced !== '' && displaced !== pinnedPid) {
    console.log(`Attaching to game pid ${pinnedPid} (--pid)  <-- replaced BFC_GAME_PID=${displaced} from your environment`);
  } else {
    console.log(`Attaching to game pid ${pinnedPid} (--pid)`);
  }
} else if (process.env.BFC_GAME_PID) {
  console.log(`Attaching to game pid ${process.env.BFC_GAME_PID} (BFC_GAME_PID from your environment)`);
}

/**
 * `--sandbox <box>` starts Electron inside a Sandboxie box — for a second game instance that runs
 * boxed, since the live tap's agent can only reach the companion from inside the same box. Only
 * Electron goes in: the renderer dev server stays on the host, where its constant chunk writes
 * and re-reads are not subject to the box's copy-on-write view of the tree, and is loaded over
 * loopback as always.
 *
 * `Start.exe` does not pass its caller's environment into the box (measured: a variable set on
 * the launcher came out unset inside), so every variable Electron needs is handed over with an
 * explicit `/env:` switch. `/wait` keeps the launcher's lifetime tied to the boxed app — closing
 * the app still stops the renderer server — but Ctrl+C on the launcher cannot reach into the box;
 * a boxed app left running is closed from its own window.
 */
function sandboxFromArgv(argv) {
  const index = argv.findIndex((arg) => arg === '--sandbox' || arg.startsWith('--sandbox='));
  if (index === -1) return null;
  const arg = argv[index];
  const raw = arg.startsWith('--sandbox=') ? arg.slice('--sandbox='.length) : argv[index + 1];
  if (raw === undefined || raw.startsWith('--')) {
    console.error('dev --sandbox needs a Sandboxie box name, e.g. --sandbox MyBox');
    process.exit(1);
  }
  if (!/^[A-Za-z0-9_]+$/.test(raw)) {
    console.error(`dev --sandbox needs a Sandboxie box name (letters, digits, underscore), got "${raw}"`);
    process.exit(1);
  }
  return raw;
}

function sandboxieStartExe() {
  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
  const candidates = [
    path.join(programFiles, 'Sandboxie-Plus', 'Start.exe'),
    path.join(programFiles, 'Sandboxie', 'Start.exe'),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found === undefined) {
    console.error(`dev --sandbox: Sandboxie's Start.exe was not found at ${candidates.join(' or ')}`);
    process.exit(1);
  }
  return found;
}

const sandboxBox = sandboxFromArgv(process.argv);
const sandboxieStart = sandboxBox === null ? null : sandboxieStartExe();
if (sandboxBox !== null) {
  console.log(`Starting Electron inside Sandboxie box "${sandboxBox}" (--sandbox); the renderer dev server stays on the host`);
}

// Another session's dev server — the web planner on 3000, say — is left alone and the renderer
// moves up a port. It has to be settled here, before Next starts: Next falls back to the next
// port by itself, but then the wait below would be answered by the other server and Electron
// would open on that instead.
const DEV_PORT = await findFreePort(PREFERRED_PORT);
if (DEV_PORT === null) {
  console.error(`No free port from ${PREFERRED_PORT} upwards. Set BFC_RENDERER_PORT and retry.`);
  process.exit(1);
}
if (DEV_PORT !== PREFERRED_PORT) {
  console.log(`Port ${PREFERRED_PORT} is in use by another process; using ${DEV_PORT} for the renderer instead.`);
}

// Invoke Next via node + local CLI so Windows does not re-parse paths through cmd.exe.
const nextCli = path.join(desktopRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
/** @type {import('node:child_process').ChildProcess | null} */
let electronProc = null;

const nextDev = run(process.execPath, [nextCli, 'dev', 'renderer', '--port', String(DEV_PORT)], {
  cwd: desktopRoot,
  windowsHide: true,
  env: {
    ...process.env,
    NODE_ENV: 'development',
  },
});

nextDev.on('exit', (code) => {
  if (code && code !== 0) {
    electronProc?.kill('SIGTERM');
    process.exit(code);
  }
});

await waitForPort(DEV_PORT);

const electronBin =
  process.platform === 'win32'
    ? path.join(desktopRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
    : path.join(desktopRoot, 'node_modules', '.bin', 'electron');

// Cursor/VS Code set ELECTRON_RUN_AS_NODE in their terminal env; that breaks a real Electron app.
const {
  ELECTRON_RUN_AS_NODE: _stripRunAsNode,
  ELECTRON_NO_ASAR: _stripNoAsar,
  ...electronEnv
} = process.env;
const rendererUrl = `http://127.0.0.1:${DEV_PORT}`;

console.log(`Starting Electron (${flavor}) → ${rendererUrl}`);

const electronLaunchEnv = {
  ...electronEnv,
  NODE_ENV: 'development',
  BFC_FLAVOR: flavor,
  BFC_RENDERER_URL: rendererUrl,
};

/** Everything Electron reads from its environment, as `Start.exe /env:` switches — see
 *  {@link sandboxFromArgv} for why the box does not simply inherit it. */
function boxedEnvSwitches(env) {
  return Object.entries(env)
    .filter(([name, value]) => (name === 'NODE_ENV' || name.startsWith('BFC_')) && value !== undefined)
    .map(([name, value]) => `/env:${name}=${value}`);
}

const electronLaunch =
  sandboxieStart === null
    ? { command: electronBin, args: ['.'] }
    : {
        command: sandboxieStart,
        args: [`/box:${sandboxBox}`, '/wait', ...boxedEnvSwitches(electronLaunchEnv), electronBin, desktopRoot],
      };

electronProc = run(electronLaunch.command, electronLaunch.args, {
  cwd: desktopRoot,
  // Do not set windowsHide — CREATE_NO_WINDOW can keep the BrowserWindow invisible on Windows.
  env: electronLaunchEnv,
});

electronProc.on('error', (err) => {
  console.error('Failed to start Electron:', err);
  nextDev.kill('SIGTERM');
  process.exit(1);
});

const shutdown = () => {
  nextDev.kill('SIGTERM');
  electronProc?.kill('SIGTERM');
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

electronProc.on('exit', (code) => {
  nextDev.kill('SIGTERM');
  process.exit(code ?? 0);
});
