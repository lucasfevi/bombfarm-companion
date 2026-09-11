import net from 'node:net';

/**
 * Which port the renderer dev server should take, decided the way Electron will find it: by
 * whether anything already answers on `127.0.0.1:<port>`.
 *
 * Deciding it by binding instead was wrong on Windows. A bind to `127.0.0.1:3000` succeeds while
 * another process holds the dual-stack wildcard `[::]:3000` — which is what `next dev` binds — so
 * the launcher believed the port was free, Next quietly fell back to 3001, the wait for 3000 was
 * satisfied by the OTHER server, and Electron opened on whatever that was: with a web-planner
 * session on 3000, the Electron shell showed the web planner.
 */
export function isPortTaken(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/** The first port at or above `start` nothing answers on; `null` once `attempts` are exhausted. */
export async function findFreePort(start, { attempts = 20, probe = isPortTaken } = {}) {
  for (let port = start; port < start + attempts; port += 1) {
    if (!(await probe(port))) return port;
  }
  return null;
}
