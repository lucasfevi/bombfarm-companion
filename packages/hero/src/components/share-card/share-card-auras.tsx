import { abilityName } from '@bombfarm/domain/game-labels';
import { AbilityIcon } from '@bombfarm/game-art';
import { cn } from '@bombfarm/ui';
import { sub, type Lang, type ShareCardCopy } from '../../copy';
import type { AuraCoverage, AuraCoverageTile } from '../../model';
import { shareEyebrowClass, shareWellClass } from './share-card-parts';

export function ShareAuraGrid({
  coverage,
  copy,
  lang,
}: {
  coverage: AuraCoverage;
  copy: ShareCardCopy;
  lang: Lang;
}) {
  return (
    <section className="grid gap-2 px-[22px] pt-4" data-testid="share-card-auras">
      <p className={shareEyebrowClass}>
        {sub(copy.aurasTitle, { covered: coverage.coveredCount, total: coverage.total })}
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {coverage.tiles.map((tile) => (
          <AuraTile key={tile.auraId} tile={tile} copy={copy} lang={lang} />
        ))}
      </div>
    </section>
  );
}

function AuraTile({ tile, copy, lang }: { tile: AuraCoverageTile; copy: ShareCardCopy; lang: Lang }) {
  const level = tile.covered ? tile.level : 0;
  return (
    <div
      className={cn(
        shareWellClass,
        'grid',
        'min-w-0',
        'grid-cols-[30px_minmax(0,1fr)]',
        'items-center',
        'gap-2',
        'px-2',
        'py-1.5',
        tile.covered ? undefined : 'opacity-40',
      )}
      data-testid={`share-card-aura-${tile.auraId}`}
      data-covered={tile.covered ? 'true' : 'false'}
    >
      <AbilityIcon code={tile.auraId} size="xs" className="size-[30px]" />
      <div className="min-w-0 leading-tight">
        <p className="m-0 text-xs text-ink">{abilityName(tile.auraId, lang)}</p>
        <p className={cn('m-0', 'text-[10.5px]', tile.covered ? 'font-semibold text-up' : 'text-muted')}>
          {tile.covered ? tile.valueText : copy.auraMissing}
        </p>
        <p className="m-0 font-mono text-[10px] text-muted tabular-nums">
          {sub(copy.auraLevel, { level, max: tile.maxLevel })}
        </p>
      </div>
    </div>
  );
}
