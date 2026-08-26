import type { ReactNode } from 'react';
import { Panel, PanelHeader } from '@bombfarm/ui';
import type { LiveHeroFact } from '../../lib/live/live-model';
import { HeroRow } from './hero-row';

export function HeroList<T extends LiveHeroFact>({
  testId,
  title,
  emptyLine,
  heroes,
  renderTrailing,
}: {
  testId: string;
  title: string;
  emptyLine: string;
  heroes: readonly T[];
  renderTrailing?: (hero: T) => ReactNode;
}) {
  return (
    <Panel data-testid={testId}>
      <PanelHeader title={title} />
      {heroes.length === 0 ? (
        <p data-testid={`${testId}-empty`} className="m-0 text-sm text-muted">
          {emptyLine}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {heroes.map((hero) => (
            <HeroRow key={hero.id} hero={hero} trailing={renderTrailing?.(hero)} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
