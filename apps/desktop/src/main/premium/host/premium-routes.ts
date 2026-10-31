import { PREMIUM_SHARED_MODULES } from '@bombfarm/contracts';

/**
 * What the `app://` handler serves under `/_premium/`: the active bundle's UI files, straight from
 * the host's memory, and one small shim per shared module. Nothing here touches the disk, and
 * every other path under `_premium` is a miss.
 */

export interface PremiumResource {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
}

export interface PremiumRoutes {
  /** The resource for a decoded pathname under `/_premium/`, or null for anything else. */
  resolve(pathname: string): PremiumResource | null;
}

/** The verified files of the bundle the host serves now. */
export interface ServedBundle {
  readonly sequence: number;
  readonly files: ReadonlyMap<string, Uint8Array>;
}

export interface PremiumRoutesDeps {
  /** The export names of each shared module, by module name (the build writes them). */
  readonly shims: Readonly<Record<string, readonly string[]>>;
  /** The bundle in memory; null when none is active. */
  readonly active: () => ServedBundle | null;
}

export const PREMIUM_PATH_PREFIX = '/_premium/';

/** The address the renderer imports a served file from; the `app://` handler answers it. */
export function premiumUiUrl(sequence: number, file: 'ui/index.js' | 'ui/index.css'): string {
  return `app://bundle${PREMIUM_PATH_PREFIX}${String(sequence)}/${file}`;
}
/** The name of the global the renderer sets to the table of live shared modules. */
export const SHARED_GLOBAL = '__bfcPremiumShared';

const JS_MIME = 'text/javascript';
const CSS_MIME = 'text/css';
const SERVED_FILES: Readonly<Record<string, string>> = { 'ui/index.js': JS_MIME, 'ui/index.css': CSS_MIME };

/** `react/jsx-runtime` is served as `react__jsx-runtime.js`: a module name has no slash in a file name. */
export function shimFileName(moduleName: string): string {
  return `${moduleName.replaceAll('/', '__')}.js`;
}

/** The text of one shim: the live module's names re-exported from the table the renderer set. */
export function shimSource(moduleName: string, names: readonly string[]): string {
  const lines = [
    `const m = globalThis.${SHARED_GLOBAL}[${JSON.stringify(moduleName)}];`,
    'export default m.default ?? m;',
  ];
  if (names.length > 0) lines.push(`export const { ${names.join(', ')} } = m;`);
  return `${lines.join('\n')}\n`;
}

export function createPremiumRoutes(deps: PremiumRoutesDeps): PremiumRoutes {
  const encoder = new TextEncoder();
  const shimBytes = new Map<string, Uint8Array>();
  for (const name of PREMIUM_SHARED_MODULES) {
    shimBytes.set(shimFileName(name), encoder.encode(shimSource(name, deps.shims[name] ?? [])));
  }

  return {
    resolve(pathname) {
      if (!pathname.startsWith(PREMIUM_PATH_PREFIX)) return null;
      const active = deps.active();
      if (active === null) return null;
      const parts = pathname.slice(PREMIUM_PATH_PREFIX.length).split('/');

      if (parts[0] === '_shared' && parts.length === 2) {
        const bytes = shimBytes.get(parts[1] ?? '');
        return bytes === undefined ? null : { bytes, mimeType: JS_MIME };
      }
      const [sequence, ...rest] = parts;
      if (sequence !== String(active.sequence)) return null;
      const file = rest.join('/');
      const mimeType = SERVED_FILES[file];
      const bytes = mimeType === undefined ? undefined : active.files.get(file);
      return bytes === undefined || mimeType === undefined ? null : { bytes, mimeType };
    },
  };
}
