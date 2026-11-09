'use client';

import { Banner, formatTimeAgo, InfoTip, type Lang } from '@bombfarm/ui';
import { sub, useCopy, useLocale, type Copy } from '../lib/copy';
import { formatCapturedAt } from '../lib/format';
import type { DataNotice } from '../lib/account/data-notices';

function noticeCopy(notice: DataNotice, t: Copy, lang: Lang): { text: string; info: string } {
  switch (notice.kind) {
    case 'skillTreeStale':
      return {
        text: sub(t.dataNoticeSkillTreeStale, {
          age: notice.capturedAt === null ? formatTimeAgo(0, lang) : formatCapturedAt(notice.capturedAt, lang),
        }),
        info: t.dataNoticeSkillTreeStaleInfo,
      };
    case 'skillTreeWithheld':
      return { text: t.dataNoticeSkillTreeWithheld, info: t.dataNoticeSkillTreeWithheldInfo };
    case 'gearOwnerUnknown':
      return { text: t.dataNoticeGearOwnerUnknown, info: t.dataNoticeGearOwnerUnknownInfo };
    case 'gearFieldsAbsent':
      return { text: t.dataNoticeGearFieldsAbsent, info: t.dataNoticeGearFieldsAbsentInfo };
    case 'heroesAndItemsNotReading':
      return {
        text:
          notice.capturedAt === null
            ? t.dataNoticeHeroesAndItemsUnread
            : sub(t.dataNoticeHeroesAndItemsStale, { age: formatCapturedAt(notice.capturedAt, lang) }),
        info: t.dataNoticeHeroesAndItemsInfo,
      };
  }
}

export function DataNoticesBanner({ notices }: { notices: readonly DataNotice[] }) {
  const t = useCopy();
  const { lang } = useLocale();
  return (
    <Banner tone="warn" layout="embedded" data-testid="data-notices" className="mt-0 flex flex-col gap-1">
      {notices.map((notice) => {
        const { text, info } = noticeCopy(notice, t, lang);
        return (
          <p key={notice.kind} data-testid={`data-notice-${notice.kind}`} className="flex items-center gap-2">
            <span>{text}</span>
            <InfoTip label={t.dataNoticeInfoLabel} tip={info} />
          </p>
        );
      })}
    </Banner>
  );
}
