const FORBIDDEN_SWITCH_PREFIXES = ['remote-debugging-', 'remote-allow-origins', 'inspect', 'js-flags'] as const;

const SWITCH_NAME = /^(?:--|-|\/)([^=\s]+)/;

export function findForbiddenDebugSwitch(argv: readonly string[]): string | null {
  for (const argument of argv) {
    const name = SWITCH_NAME.exec(argument)?.[1]?.toLowerCase();
    if (name !== undefined && FORBIDDEN_SWITCH_PREFIXES.some((prefix) => name.startsWith(prefix))) {
      return argument;
    }
  }
  return null;
}

export interface DebugSwitchGuardDeps {
  readonly isPackaged: boolean;
  readonly argv: readonly string[];
  readonly exit: (code: number) => void;
  readonly writeLine: (line: string) => void;
}

/** Returns whether it ended the process. Only a packaged build refuses: Playwright and the dev
 *  scripts pass these switches to the unpackaged binary on purpose. */
export function refuseDebugSwitchesWhenPackaged(deps: DebugSwitchGuardDeps): boolean {
  if (!deps.isPackaged) return false;
  const offending = findForbiddenDebugSwitch(deps.argv);
  if (offending === null) return false;
  deps.writeLine(`debug_switch.refused ${offending}`);
  deps.exit(1);
  return true;
}
