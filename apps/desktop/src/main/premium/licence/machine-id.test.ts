import { describe, expect, it } from 'vitest';
import { createMachineIdentity, type RunRegistryQuery } from './machine-id.js';

const GUID = '11111111-2222-3333-4444-555555555555';

// What `reg query` prints on Windows: a blank line, the key, the value line, a blank line, CRLF endings.
const REG_OUTPUT = `\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography\r\n    MachineGuid    REG_SZ    ${GUID}\r\n\r\n`;

interface Spawn {
  file: string;
  args: readonly string[];
  options: { windowsHide: boolean; timeout: number };
}

function fakeRegistry(reply: () => Promise<string>): { run: RunRegistryQuery; spawns: Spawn[] } {
  const spawns: Spawn[] = [];
  return {
    spawns,
    run: (file, args, options) => {
      spawns.push({ file, args, options });
      return reply();
    },
  };
}

function identity(reply: () => Promise<string>, hostname = (): string => 'DESKTOP-TEST') {
  const registry = fakeRegistry(reply);
  return { ...registry, identity: createMachineIdentity({ run: registry.run, hostname }) };
}

describe('machineGuid', () => {
  it('asks for the 64-bit MachineGuid value, hidden, with a 5 second timeout', async () => {
    const { identity: id, spawns } = identity(() => Promise.resolve(REG_OUTPUT));

    await id.machineGuid();

    expect(spawns).toEqual([
      {
        file: 'reg',
        args: ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'],
        options: { windowsHide: true, timeout: 5000 },
      },
    ]);
  });

  it('parses the REG_SZ value out of real reg output', async () => {
    const { identity: id } = identity(() => Promise.resolve(REG_OUTPUT));
    expect(await id.machineGuid()).toBe(GUID);
  });

  it('parses output with LF endings and a tab separator', async () => {
    const { identity: id } = identity(() => Promise.resolve(`\nHKEY\n    MachineGuid\tREG_SZ\t${GUID}\n`));
    expect(await id.machineGuid()).toBe(GUID);
  });

  it.each([
    ['no MachineGuid line', 'ERROR: The system was unable to find the specified registry key or value.'],
    ['a value of another type', `    MachineGuid    REG_DWORD    0x1`],
    ['an empty value', '    MachineGuid    REG_SZ    \r\n'],
    ['empty output', ''],
  ])('answers null for %s', async (_name, output) => {
    const { identity: id } = identity(() => Promise.resolve(output));
    expect(await id.machineGuid()).toBeNull();
  });

  it('answers null when reg exits non-zero', async () => {
    const { identity: id } = identity(() => Promise.reject(Object.assign(new Error('exit 1'), { code: 1 })));
    expect(await id.machineGuid()).toBeNull();
  });

  it('answers null when reg is killed by the timeout', async () => {
    const { identity: id } = identity(() => Promise.reject(Object.assign(new Error('timed out'), { killed: true })));
    expect(await id.machineGuid()).toBeNull();
  });

  it('answers null when the spawn itself throws', async () => {
    const registry = createMachineIdentity({
      run: () => {
        throw new Error('spawn reg ENOENT');
      },
      hostname: () => 'x',
    });
    expect(await registry.machineGuid()).toBeNull();
  });

  it('reads the registry once per run: a second call does not spawn', async () => {
    const { identity: id, spawns } = identity(() => Promise.resolve(REG_OUTPUT));

    const first = await id.machineGuid();
    const second = await id.machineGuid();

    expect(first).toBe(GUID);
    expect(second).toBe(GUID);
    expect(spawns).toHaveLength(1);
  });
});

describe('computerName', () => {
  const nameOf = (raw: string): string => identity(() => Promise.resolve(''), () => raw).identity.computerName();

  it('passes a plain name through', () => {
    expect(nameOf('DESKTOP-TEST')).toBe('DESKTOP-TEST');
  });

  it('trims surrounding whitespace', () => {
    expect(nameOf('  Lucas PC \t')).toBe('Lucas PC');
  });

  it('drops control characters', () => {
    expect(nameOf('PC\u0000-\u0007A\u001b\u007fB\r\n')).toBe('PC-AB');
  });

  it('cuts to 64 characters', () => {
    expect(nameOf('a'.repeat(100))).toBe('a'.repeat(64));
  });

  it('keeps a name of exactly 64 characters whole', () => {
    expect(nameOf('b'.repeat(64))).toBe('b'.repeat(64));
  });

  it('trims again after the cut, so no trailing space is sent', () => {
    expect(nameOf(`${'c'.repeat(63)} d`)).toBe('c'.repeat(63));
  });
});
