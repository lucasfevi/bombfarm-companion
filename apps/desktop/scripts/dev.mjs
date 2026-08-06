import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import process from 'node:process';
import { parseFlavorToken } from '@bombfarm/contracts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..');
const DEV_PORT = Number(process.env.BFC_RENDERER_PORT ?? 3000);

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

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
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

if (!(await isPortFree(DEV_PORT))) {
  console.error(
    `Port ${DEV_PORT} is already in use. Stop the other process (or set BFC_RENDERER_PORT) and retry.`,
  );
  process.exit(1);
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

electronProc = run(electronBin, ['.'], {
  cwd: desktopRoot,
  // Do not set windowsHide — CREATE_NO_WINDOW can keep the BrowserWindow invisible on Windows.
  env: {
    ...electronEnv,
    NODE_ENV: 'development',
    BFC_FLAVOR: flavor,
    BFC_RENDERER_URL: rendererUrl,
  },
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
