import type { Strings } from '@/shared/i18n';
import { ScreenCard } from './screen-card';

export function IncludedScreens({ t }: { t: Strings }) {
  return (
    <section>
      <p className="m-0 mb-4 flex items-center gap-3 font-mono text-[10.5px] tracking-[0.17em] text-muted uppercase after:h-px after:flex-1 after:bg-line/60 after:content-['']">
        {t.downloadIncludedHeading}
      </p>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2 xl:grid-cols-4">
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
          title={t.downloadScreenSettingsTitle}
          items={[
            t.downloadScreenSettingsItem1,
            t.downloadScreenSettingsItem2,
            t.downloadScreenSettingsItem3,
            t.downloadScreenSettingsItem4,
          ]}
        />
      </div>
    </section>
  );
}
