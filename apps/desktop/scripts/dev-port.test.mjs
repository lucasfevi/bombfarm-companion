import net from 'node:net';
import { describe, expect, it } from 'vitest';
import { findFreePort, isPortTaken } from './dev-port.mjs';

/** A listener bound the way `next dev` binds — the unspecified address, dual-stack where the OS
 *  offers it — on a port the OS picks, so the test never collides with a real dev server. */
function listenLikeNext() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, () => {
      resolve({ port: server.address().port, close: () => new Promise((done) => server.close(done)) });
    });
  });
}

describe('isPortTaken', () => {
  it('sees a wildcard listener from the loopback address Electron will connect to', async () => {
    const other = await listenLikeNext();
    try {
      expect(await isPortTaken(other.port)).toBe(true);
    } finally {
      await other.close();
    }
  });

  it('reports a port nothing answers on as free', async () => {
    const other = await listenLikeNext();
    const { port } = other;
    await other.close();
    expect(await isPortTaken(port)).toBe(false);
  });
});

describe('findFreePort', () => {
  it('moves up past the ports another session holds, and no further', async () => {
    const taken = new Set([3000, 3001]);
    const probe = (port) => Promise.resolve(taken.has(port));
    expect(await findFreePort(3000, { probe })).toBe(3002);
  });

  it('keeps the preferred port when it is free', async () => {
    const probe = () => Promise.resolve(false);
    expect(await findFreePort(3100, { probe })).toBe(3100);
  });

  it('gives up with null rather than scanning forever', async () => {
    const probe = () => Promise.resolve(true);
    expect(await findFreePort(3000, { probe, attempts: 3 })).toBeNull();
  });

  it('walks past a real wildcard listener to the port after it', async () => {
    const other = await listenLikeNext();
    try {
      const chosen = await findFreePort(other.port, { attempts: 5 });
      expect(chosen).not.toBe(other.port);
      expect(chosen).toBeGreaterThan(other.port);
    } finally {
      await other.close();
    }
  });
});
