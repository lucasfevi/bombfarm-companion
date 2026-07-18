import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..');
const rendererDir = path.join(desktopRoot, 'renderer');

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  return child;
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

const flavor = process.env.BFC_FLAVOR === 'dev' ? 'dev' : 'prod';

const nextDev = run('pnpm', ['exec', 'next', 'dev', '--port', '3000'], {
  cwd: rendererDir,
  env: {
    ...process.env,
    NODE_ENV: 'development',
  },
});

await waitForPort(3000);

const electronBin =
  process.platform === 'win32'
    ? path.join(desktopRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
    : path.join(desktopRoot, 'node_modules', '.bin', 'electron');

const electronProc = run(electronBin, ['.'], {
  cwd: desktopRoot,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    BFC_FLAVOR: flavor,
    BFC_RENDERER_URL: 'http://127.0.0.1:3000',
  },
});

const shutdown = () => {
  nextDev.kill('SIGTERM');
  electronProc.kill('SIGTERM');
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

electronProc.on('exit', (code) => {
  nextDev.kill('SIGTERM');
  process.exit(code ?? 0);
});

nextDev.on('exit', (code) => {
  if (code && code !== 0) {
    electronProc.kill('SIGTERM');
    process.exit(code);
  }
});
