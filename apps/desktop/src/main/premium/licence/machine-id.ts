import { execFile } from 'node:child_process';
import { hostname } from 'node:os';
import { promisify } from 'node:util';

export interface MachineIdentity {
  /** The Windows MachineGuid as read, or null when it cannot be read. Read once per run. */
  machineGuid(): Promise<string | null>;
  computerName(): string;
}

/** Runs one registry query and resolves with its stdout; rejects on a non-zero exit or a timeout. */
export type RunRegistryQuery = (
  file: string,
  args: readonly string[],
  options: { windowsHide: boolean; timeout: number },
) => Promise<string>;

export interface MachineIdentityDeps {
  run: RunRegistryQuery;
  hostname: () => string;
}

const MAX_COMPUTER_NAME = 64;
const REG_TIMEOUT_MS = 5000;
const GUID_LINE = /MachineGuid\s+REG_SZ\s+(\S.*)/;
// eslint-disable-next-line no-control-regex -- the point is to match control characters
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;

export function createMachineIdentity(deps: MachineIdentityDeps): MachineIdentity {
  let guid: string | null = null;

  async function readGuid(): Promise<string | null> {
    try {
      // `/reg:64` reads the 64-bit view whatever the bitness of this process.
      const output = await deps.run(
        'reg',
        ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'],
        { windowsHide: true, timeout: REG_TIMEOUT_MS },
      );
      const value = GUID_LINE.exec(output)?.[1]?.trim();
      return value === undefined || value === '' ? null : value;
    } catch {
      return null;
    }
  }

  return {
    async machineGuid() {
      // Only a successful read is kept: a failure is tried again on the next call.
      guid ??= await readGuid();
      return guid;
    },
    computerName() {
      return deps.hostname().replace(CONTROL_CHARACTERS, '').trim().slice(0, MAX_COMPUTER_NAME).trim();
    },
  };
}

const execFileAsync = promisify(execFile);

export function createSystemMachineIdentity(): MachineIdentity {
  return createMachineIdentity({
    run: async (file, args, options) => (await execFileAsync(file, [...args], { ...options, encoding: 'utf8' })).stdout,
    hostname,
  });
}
