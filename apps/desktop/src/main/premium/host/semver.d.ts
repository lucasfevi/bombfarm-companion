/** The few `semver` functions the host uses; the package ships no declarations of its own. */
declare module 'semver' {
  export function valid(version: string): string | null;
  export function gte(a: string, b: string): boolean;
  export function lt(a: string, b: string): boolean;
  export function satisfies(version: string, range: string): boolean;
}
