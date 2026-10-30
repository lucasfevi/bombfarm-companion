import { describe, expect, it } from 'vitest';
import { createDefaultRemovalPort } from './removal-port';

describe('the default removal port', () => {
  it('reports the folder gone on the next tick, not synchronously', async () => {
    const port = createDefaultRemovalPort();
    let gone = 0;
    port.attach(() => {
      gone += 1;
    });

    port.requestPremiumRemoval('moved');
    expect(gone).toBe(0);

    await Promise.resolve();
    expect(gone).toBe(1);
  });

  it('reports once per request, whatever the reason', async () => {
    const port = createDefaultRemovalPort();
    let gone = 0;
    port.attach(() => {
      gone += 1;
    });

    port.requestPremiumRemoval('ended');
    port.requestPremiumRemoval('released');
    await Promise.resolve();

    expect(gone).toBe(2);
  });

  it('runs no bundle', () => {
    expect(createDefaultRemovalPort().runningSequence()).toBeNull();
  });

  it('does nothing when no one is attached', async () => {
    const port = createDefaultRemovalPort();

    expect(() => {
      port.requestPremiumRemoval('ended');
    }).not.toThrow();
    await Promise.resolve();
  });
});
