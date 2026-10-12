"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type RefObject } from "react";
import type { Strings, Lang } from "@/shared/i18n";
import { Icon, Menu, buttonRecipe } from "@bombfarm/ui";
import { REFERRAL_CODE } from "@/shared/referral";
import { SITE_SECTION_HREF } from "@/shared/lib/site-sections";
import { prefetchOnIntent } from "./prefetch-on-intent";

const COFFEE_URL = "https://buymeacoffee.com/lucasfevi";

/**
 * Every action the wide header lays out in a row, as one menu for a phone-width bar. The download
 * link sits in here too: its label is a whole sentence, wider than the room left beside the brand.
 */
export function SiteHeaderMenu({
  t,
  lang,
  downloadActive,
  referralCodeRef,
  onCopyReferral,
  onImport,
  onLangChange,
}: {
  t: Strings;
  lang: Lang;
  downloadActive: boolean;
  referralCodeRef: RefObject<HTMLElement | null>;
  onCopyReferral: () => Promise<boolean>;
  onImport?: () => void;
  onLangChange: (lang: Lang) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function copyReferral() {
    if (await onCopyReferral()) setOpen(false);
  }

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger
        aria-label={t.siteMenuAria}
        data-testid="header-menu"
        className={buttonRecipe({ variant: "default" })}
      >
        <Icon name="ellipsis-horizontal" size="sm" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={6}>
          <Menu.Popup data-testid="header-menu-popup">
            <Menu.Item
              render={
                <Link
                  href={SITE_SECTION_HREF.download}
                  prefetch={false}
                  {...prefetchOnIntent(router, SITE_SECTION_HREF.download)}
                  aria-current={downloadActive ? "page" : undefined}
                />
              }
              data-testid="header-menu-download"
            >
              {t.downloadHeaderCta}
            </Menu.Item>
            {onImport ? (
              <Menu.Item onClick={onImport} data-testid="header-menu-import">
                {t.importHeroesBtn}
              </Menu.Item>
            ) : null}
            <Menu.Item
              closeOnClick={false}
              onClick={copyReferral}
              data-testid="header-menu-referral"
            >
              <Icon name="copy" size="sm" />
              {t.referralCopy}
              <span
                ref={referralCodeRef}
                className="ml-auto pl-3 font-mono text-[11px] text-muted"
              >
                {REFERRAL_CODE}
              </span>
            </Menu.Item>
            <Menu.Item
              render={<a href={COFFEE_URL} target="_blank" rel="noreferrer" />}
              data-testid="header-menu-coffee"
            >
              <Icon name="coffee" size="sm" />
              {t.coffee}
            </Menu.Item>
            <Menu.Separator />
            <Menu.Group>
              <Menu.GroupLabel>{t.siteMenuLanguage}</Menu.GroupLabel>
              <Menu.RadioGroup
                value={lang}
                onValueChange={(next: unknown) => {
                  if (next === "pt" || next === "en") onLangChange(next);
                }}
              >
                <Menu.RadioItem
                  value="pt"
                  data-testid="header-menu-language-pt"
                >
                  <Menu.RadioItemIndicator>
                    <Icon name="check" size="xs" />
                  </Menu.RadioItemIndicator>
                  Português
                </Menu.RadioItem>
                <Menu.RadioItem
                  value="en"
                  data-testid="header-menu-language-en"
                >
                  <Menu.RadioItemIndicator>
                    <Icon name="check" size="xs" />
                  </Menu.RadioItemIndicator>
                  English
                </Menu.RadioItem>
              </Menu.RadioGroup>
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
