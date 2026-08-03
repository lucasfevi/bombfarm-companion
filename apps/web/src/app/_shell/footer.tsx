import { BiCoffee } from 'react-icons/bi';
import type { Strings } from '@/shared/i18n';
import { WIKI_URL } from '@bombfarm/domain/wiki-assets';

import { buttonRecipe } from '@bombfarm/ui';

export function Footer({ t }: { t: Strings }) {
  return (
    <footer className="mx-auto mt-5 flex max-w-app flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3.5">
      <div className="m-0 max-w-[68ch] text-xs leading-normal text-muted">
        <p className="m-0">{t.disclaimer}</p>
        <p className="m-0 mt-1">
          {t.wikiArtCredit}{' '}
          <a
            className="text-accent underline-offset-2 hover:underline"
            href={WIKI_URL}
            target="_blank"
            rel="noreferrer"
          >
            {t.wikiArtCreditLink}
          </a>
          .
        </p>
      </div>
      <a
        className={buttonRecipe({ variant: 'coffee-full' })}
        href="https://buymeacoffee.com/lucasfevi"
        target="_blank"
        rel="noreferrer"
      >
        <BiCoffee size={16} aria-hidden="true" />
        {t.coffee}
      </a>
    </footer>
  );
}
