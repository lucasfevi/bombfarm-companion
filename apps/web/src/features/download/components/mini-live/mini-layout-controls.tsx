import { SegmentedToggle, Switch, cn } from '@bombfarm/ui';
import type { Lang, Strings } from '@/shared/i18n';
import { liveLabel, type MirroredKey } from '../../model/live-replica-copy';
import {
  enabledSectionCount,
  isMiniSectionDisabled,
  withMiniSection,
  type MiniLiveLayout,
  type MiniSectionKey,
} from '../../model/mini-live-layout';

const SECTIONS: readonly { readonly key: MiniSectionKey; readonly labelKey: MirroredKey }[] = [
  { key: 'showEarnings', labelKey: 'liveEarningsTitle' },
  { key: 'showMap', labelKey: 'liveMapTitle' },
  { key: 'showHeroes', labelKey: 'liveHeroesTitle' },
];

/**
 * The real control cluster, carrying the choices the app's own gear menu offers. It is the part
 * of this section a reader operates, so unlike the drawing it stays in the accessibility tree:
 * each switch names its panel and announces its own state.
 */
export function MiniLayoutControls({
  t,
  lang,
  layout,
  onLayoutChange,
}: {
  t: Strings;
  lang: Lang;
  layout: MiniLiveLayout;
  onLayoutChange: (next: MiniLiveLayout) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-1 rounded-xl border border-line bg-surface p-4 md:w-68 md:shrink-0">
      <p className="m-0 mb-1 font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
        {t.downloadMiniControlsTitle}
      </p>
      {SECTIONS.map(({ key, labelKey }) => {
        const label = liveLabel(labelKey, lang);
        return (
          <label key={key} className="flex items-center justify-between gap-3 py-1">
            <span className="text-sm text-ink">{label}</span>
            <Switch
              checked={layout[key]}
              disabled={isMiniSectionDisabled(layout, key)}
              onCheckedChange={(next) => {
                onLayoutChange(withMiniSection(layout, key, next));
              }}
              aria-label={label}
            />
          </label>
        );
      })}
      <div className="mt-2 border-t border-line/55 pt-3">
        <span className="mb-2 block text-[10px] tracking-wide text-muted uppercase">
          {liveLabel('miniLiveAxisLabel', lang)}
        </span>
        <SegmentedToggle
          options={[
            { id: 'vertical', label: liveLabel('miniLiveAxisVerticalLabel', lang) },
            { id: 'horizontal', label: liveLabel('miniLiveAxisHorizontalLabel', lang) },
          ]}
          value={layout.axis}
          onChange={(picked) => {
            if (picked === 'vertical' || picked === 'horizontal') {
              onLayoutChange({ ...layout, axis: picked });
            }
          }}
          ariaLabel={liveLabel('miniLiveAxisLabel', lang)}
        />
      </div>
      {/* The note keeps its line whether or not it applies. The desktop hides it as `sr-only`
          inside a popover, where nothing sits under it to be pushed; here the section below the
          controls would move every time a reader switched a panel off. */}
      <p
        data-testid="download-mini-last-section-note"
        aria-hidden={enabledSectionCount(layout) > 1 || undefined}
        className={cn('m-0 mt-3 text-[10px] text-muted', enabledSectionCount(layout) > 1 && 'invisible')}
      >
        {liveLabel('miniLiveLastSectionNote', lang)}
      </p>
    </div>
  );
}
