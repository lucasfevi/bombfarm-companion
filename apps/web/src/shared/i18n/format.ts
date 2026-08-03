/** Tiny template helper: sub('a {x}', { x: 1 }) → 'a 1'. */
export function sub(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(vars[key] ?? ''));
}

/** Split `<em>…</em>` markers used to emphasize UI section names in guide copy. */
export function parseEmphasis(text: string): Array<{ kind: 'text' | 'em'; value: string }> {
  const parts: Array<{ kind: 'text' | 'em'; value: string }> = [];
  const emphasisPattern = /<em>(.*?)<\/em>/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = emphasisPattern.exec(text)) !== null) {
    if (match.index > last) parts.push({ kind: 'text', value: text.slice(last, match.index) });
    parts.push({ kind: 'em', value: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) });
  return parts;
}
