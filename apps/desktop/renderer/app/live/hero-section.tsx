import { Fragment, type ReactNode } from 'react';
import { useLocale } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import type { LiveHeroFact } from '../../lib/live/live-model';
import { HeroCard } from './hero-card';

/** One rotation state inside the Heroes panel — a heading, its count, and a grid of hero cards. */
export function HeroSection<T extends LiveHeroFact>({
  testId,
  title,
  count,
  hint,
  facts,
  emptyLine,
  heroes,
  muted = false,
  renderTrailing,
}: {
  testId: string;
  title: string;
  /** Replaces the plain hero count beside the title — the field's own occupancy, say. */
  count?: string;
  /** What raises this section's cap, shown only while the account is below it. */
  hint?: string;
  /** Short readings about the section as a whole, not about any one hero in it. */
  facts?: readonly string[];
  emptyLine: string;
  heroes: readonly T[];
  /** Drains the colour from every card in this section. */
  muted?: boolean;
  renderTrailing?: (hero: T) => ReactNode;
}) {
  const { locale } = useLocale();

  return (
    <section data-testid={testId}>
      <div className="mb-2 border-b border-line pb-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="m-0 text-[11px] font-bold tracking-[0.06em] text-muted uppercase">
            {title}
            <span aria-hidden> · </span>
            <span data-testid={`${testId}-count`} className="tabular-nums text-ink">
              {count ?? formatCount(heroes.length, locale)}
            </span>
          </h3>
          {facts !== undefined && facts.length > 0 ? (
            <p
              data-testid={`${testId}-facts`}
              className="m-0 flex flex-wrap items-baseline gap-x-1.5 text-[11px] leading-none text-muted"
            >
              {facts.map((fact, index) => (
                <Fragment key={fact}>
                  {index > 0 ? <span aria-hidden>·</span> : null}
                  <span>{fact}</span>
                </Fragment>
              ))}
            </p>
          ) : null}
        </div>
        {hint !== undefined ? (
          <p data-testid={`${testId}-hint`} className="m-0 mt-1 text-[11px] leading-none text-muted">
            {hint}
          </p>
        ) : null}
      </div>
      {heroes.length === 0 ? (
        <p data-testid={`${testId}-empty`} className="m-0 text-sm text-muted">
          {emptyLine}
        </p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-2 p-0">
          {heroes.map((hero) => (
            <HeroCard key={hero.id} hero={hero} muted={muted} trailing={renderTrailing?.(hero)} />
          ))}
        </ul>
      )}
    </section>
  );
}
