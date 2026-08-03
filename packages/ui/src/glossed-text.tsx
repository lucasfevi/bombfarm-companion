import { cn } from './cn';
import { escapeRegExp } from './escape-reg-exp';
import { GlossaryTerm } from './glossary-term';

export type GlossedTextProps = {
  /** Formula/expression template string, e.g. `t.bdFormulaDmg`. */
  template: string;
  /** Token → tooltip text. Empty map renders the plain-wrapper fast path. */
  terms: ReadonlyMap<string, string>;
  className?: string;
};

/**
 * Longest-token-first split used to build the `RegExp` alternation that finds each glossary
 * token inside `template`. Exported (React-free) so the wrapping mechanism is unit-testable
 * without rendering the component.
 */
export function splitGlossedTemplate(template: string, terms: ReadonlyMap<string, string>): string[] {
  const tokens = [...terms.keys()].sort((left, right) => right.length - left.length);
  if (tokens.length === 0) return [template];
  const tokenPattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'g');
  return template.split(tokenPattern);
}

/**
 * Renders a template string with named terms wrapped in `GlossaryTerm` tooltips. Promoted from
 * the planner's `GlossedFormula` (W6) — the split/wrap mechanism only; the game vocabulary
 * (`FORMULA_GLOSSARY`, the `Strings` lookup) stays in the feature's `model/formula-glossary.ts`.
 */
export function GlossedText({ template, terms, className }: GlossedTextProps) {
  if (terms.size === 0) {
    return <span className={cn('font-semibold text-ink', className)}>{template}</span>;
  }
  const parts = splitGlossedTemplate(template, terms);
  return (
    <span className={cn('font-semibold text-ink', className)}>
      {parts.map((part, index) => {
        const tip = terms.get(part);
        if (tip) {
          return (
            <GlossaryTerm key={`${part}-${index}`} tip={tip}>
              {part}
            </GlossaryTerm>
          );
        }
        return <span key={`t-${index}`}>{part}</span>;
      })}
    </span>
  );
}
