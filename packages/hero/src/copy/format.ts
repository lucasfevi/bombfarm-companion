/** Tiny template helper: sub('a {x}', { x: 1 }) → 'a 1'. */
export function sub(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(vars[key] ?? ''));
}
