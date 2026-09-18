import type { Strings } from '@/shared/i18n';
import { ScreenCard } from './screen-card';

export function IncludedScreens({ t }: { t: Strings }) {
  return (
    <section>
      <p className="m-0 mb-4 flex items-center gap-3 font-mono text-[10.5px] tracking-[0.17em] text-muted uppercase after:h-px after:flex-1 after:bg-line/60 after:content-['']">
        {t.downloadIncludedHeading}
      </p>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2 xl:grid-cols-3">
        <ScreenCard
          title={t.downloadScreenLiveTitle}
          items={[
            t.downloadScreenLiveItem1,
            t.downloadScreenLiveItem2,
            t.downloadScreenLiveItem3,
            t.downloadScreenLiveItem4,
            t.downloadScreenLiveItem5,
          ]}
        />
        <ScreenCard
          title={t.downloadScreenFarmTitle}
          items={[
            t.downloadScreenFarmItem1,
            t.downloadScreenFarmItem2,
            t.downloadScreenFarmItem3,
            t.downloadScreenFarmItem4,
            t.downloadScreenFarmItem5,
          ]}
        />
        <ScreenCard
          title={t.downloadScreenHeroesTitle}
          items={[
            t.downloadScreenHeroesItem1,
            t.downloadScreenHeroesItem2,
            t.downloadScreenHeroesItem3,
            t.downloadScreenHeroesItem4,
            t.downloadScreenHeroesItem5,
            t.downloadScreenHeroesItem6,
          ]}
        />
        <ScreenCard
          title={t.downloadScreenInventoryTitle}
          items={[
            t.downloadScreenInventoryItem1,
            t.downloadScreenInventoryItem2,
            t.downloadScreenInventoryItem3,
            t.downloadScreenInventoryItem4,
          ]}
        />
        <ScreenCard
          title={t.downloadScreenForgeTitle}
          items={[
            t.downloadScreenForgeItem1,
            t.downloadScreenForgeItem2,
            t.downloadScreenForgeItem3,
            t.downloadScreenForgeItem4,
          ]}
        />
        <ScreenCard
          title={t.downloadScreenOptimizerTitle}
          items={[
            t.downloadScreenOptimizerItem1,
            t.downloadScreenOptimizerItem2,
            t.downloadScreenOptimizerItem3,
            t.downloadScreenOptimizerItem4,
          ]}
        />
        <ScreenCard
          title={t.downloadScreenPvpTitle}
          items={[
            t.downloadScreenPvpItem1,
            t.downloadScreenPvpItem2,
            t.downloadScreenPvpItem3,
            t.downloadScreenPvpItem4,
          ]}
        />
        <ScreenCard
          title={t.downloadScreenSkillsTitle}
          items={[
            t.downloadScreenSkillsItem1,
            t.downloadScreenSkillsItem2,
            t.downloadScreenSkillsItem3,
            t.downloadScreenSkillsItem4,
          ]}
        />
        <ScreenCard
          title={t.downloadScreenAccountTitle}
          items={[
            t.downloadScreenAccountItem1,
            t.downloadScreenAccountItem2,
            t.downloadScreenAccountItem3,
            t.downloadScreenAccountItem4,
            t.downloadScreenAccountItem5,
          ]}
        />
        <ScreenCard
          title={t.downloadScreenSettingsTitle}
          items={[
            t.downloadScreenSettingsItem1,
            t.downloadScreenSettingsItem2,
            t.downloadScreenSettingsItem3,
            t.downloadScreenSettingsItem4,
          ]}
        />
        {/* The grid draws its dividers as a line-coloured backdrop showing through 1px gaps, so a
            trailing empty cell reads as a solid block of that colour. Ten cards fill two columns
            exactly and leave two cells at three, and none at one. */}
        <div aria-hidden className="hidden bg-bg xl:block" />
        <div aria-hidden className="hidden bg-bg xl:block" />
      </div>
    </section>
  );
}
