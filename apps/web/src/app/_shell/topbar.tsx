import { BiCoffee } from 'react-icons/bi';
import Image from 'next/image';
import type { Strings, Lang } from '@/shared/i18n';

import { Button, buttonRecipe } from '@bombfarm/ui';

export function Topbar({
  t,
  lang,
  showGuide,
  onImport,
  onToggleGuide,
  onLangChange,
}: {
  t: Strings;
  lang: Lang;
  showGuide: boolean;
  onImport: () => void;
  onToggleGuide: (next: boolean) => void;
  onLangChange: (lang: Lang) => void;
}) {
  return (
    <header className="sticky top-0 z-30 min-h-top border-b border-line bg-[color-mix(in_oklch,var(--surface)_88%,transparent)] px-4 py-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-app flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Image
            src="/favicon.svg"
            alt=""
            width={34}
            height={34}
            className="size-8.5 shrink-0"
            priority
          />
          <div>
            <div className="text-sm leading-1.1 font-bold">Bomb Farm</div>
            <div className="text-[11px] tracking-[0.04em] text-muted uppercase">{t.appSuiteTag}</div>
          </div>
        </div>
        <div className="flex flex-nowrap items-center justify-end gap-1.5 max-[720px]:flex-wrap max-[720px]:justify-start">
          <Button type="button" onClick={onImport}>
            {t.importHeroesBtn}
          </Button>
          <Button
            type="button"
            variant={showGuide ? 'help-on' : 'help'}
            onClick={() => onToggleGuide(!showGuide)}
            title={t.guideToggleTitle}
            aria-label={t.guideToggleTitle}
          >
            ?
          </Button>
          <a
            className={buttonRecipe({ variant: 'coffee' })}
            href="https://buymeacoffee.com/lucasfevi"
            target="_blank"
            rel="noreferrer"
            title={t.coffee}
            aria-label={t.coffee}
          >
            <BiCoffee size={16} aria-hidden="true" />
          </a>
          <div
            className="inline-flex h-8 shrink-0 overflow-hidden rounded-sm border border-line"
            role="group"
            aria-label="Language"
          >
            <button
              type="button"
              className={`cursor-pointer border-0 px-2.25 text-[11px] font-bold tracking-[0.03em] ${
                lang === 'pt' ? 'bg-accent text-accent-ink' : 'bg-transparent'
              }`}
              onClick={() => onLangChange('pt')}
            >
              PT
            </button>
            <button
              type="button"
              className={`cursor-pointer border-0 px-2.25 text-[11px] font-bold tracking-[0.03em] ${
                lang === 'en' ? 'bg-accent text-accent-ink' : 'bg-transparent'
              }`}
              onClick={() => onLangChange('en')}
            >
              EN
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
