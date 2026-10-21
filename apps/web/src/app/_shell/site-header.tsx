"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BiCoffee, BiCopy } from "react-icons/bi";
import type { Strings, Lang } from "@/shared/i18n";
import {
  AppNav,
  BrandLockup,
  Button,
  SegmentedToggle,
  SiteHeader as DsSiteHeader,
  Tooltip,
  buttonRecipe,
  siteHeaderBrandClass,
} from "@bombfarm/ui";
import { REFERRAL_CODE } from "@/shared/referral";
import { prefetchOnIntent } from "./prefetch-on-intent";
import { useReferralCopy } from "./use-referral-copy";
import { usePhoneHeader } from "./use-phone-header";
import { SiteHeaderMenu } from "./site-header-menu";
import {
  NAV_SECTIONS,
  SITE_SECTION_HREF,
  SITE_SECTION_LABEL_KEY,
  isSiteSectionActive,
  type SiteSection,
} from "@/shared/lib/site-sections";

export function SiteHeader({
  t,
  lang,
  onImport,
  onLangChange,
}: {
  t: Strings;
  lang: Lang;
  onImport?: () => void;
  onLangChange: (lang: Lang) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { codeRef, copy: copyReferral } = useReferralCopy(t);
  const phone = usePhoneHeader();

  return (
    <DsSiteHeader
      compact={phone}
      navRecenterKey={`${pathname}${lang}`}
      brand={
        <Link
          href="/"
          prefetch={false}
          {...prefetchOnIntent(router, "/")}
          className={siteHeaderBrandClass}
        >
          <BrandLockup
            mark={
              <Image
                src="/favicon.svg"
                alt=""
                width={34}
                height={34}
                className="size-8.5 shrink-0"
                priority
              />
            }
            title="Bomb Farm"
            tag={t.appSuiteTag}
          />
        </Link>
      }
      nav={
        <AppNav
          className="whitespace-nowrap"
          ariaLabel={t.siteNavAria}
          items={NAV_SECTIONS.map((section) => ({
            id: section,
            label: t[SITE_SECTION_LABEL_KEY[section]],
            active: isSiteSectionActive(section, pathname),
          }))}
          renderItem={(item, className) => (
            <Link
              key={item.id}
              href={SITE_SECTION_HREF[item.id as SiteSection]}
              prefetch={false}
              {...prefetchOnIntent(
                router,
                SITE_SECTION_HREF[item.id as SiteSection]
              )}
              aria-current={item.active ? "page" : undefined}
              className={className}
            >
              {item.label}
            </Link>
          )}
        />
      }
      compactActions={
        <SiteHeaderMenu
          t={t}
          lang={lang}
          downloadActive={isSiteSectionActive("download", pathname)}
          referralCodeRef={codeRef}
          onCopyReferral={copyReferral}
          onImport={onImport}
          onLangChange={onLangChange}
        />
      }
      actions={
        <>
          <Link
            href={SITE_SECTION_HREF.download}
            prefetch={false}
            {...prefetchOnIntent(router, SITE_SECTION_HREF.download)}
            aria-current={
              isSiteSectionActive("download", pathname) ? "page" : undefined
            }
            className={buttonRecipe({ variant: "primary" })}
            data-testid="header-download-cta"
          >
            {t.downloadHeaderCta}
          </Link>
          {onImport ? (
            <Button type="button" onClick={onImport}>
              {t.importHeroesBtn}
            </Button>
          ) : null}
          {/* Code only — the tooltip carries the why, the footer the full copy. */}
          <Tooltip.Provider delay={200} closeDelay={80}>
            <Tooltip.Root>
              <Tooltip.Trigger
                type="button"
                onClick={copyReferral}
                aria-label={t.referralTitle}
                data-testid="referral-topbar"
                className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-line bg-bg-2 px-2 text-[11px] font-bold tracking-[0.06em] text-muted hover:border-accent hover:text-accent motion-safe:transition-[border-color,color] motion-safe:duration-[120ms]"
              >
                <span ref={codeRef} className="font-mono">
                  {REFERRAL_CODE}
                </span>
                <BiCopy size={13} aria-hidden="true" />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={6}>
                  <Tooltip.Popup>{t.referralTitle}</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
          <Tooltip.Provider delay={200} closeDelay={80}>
            <Tooltip.Root>
              <Tooltip.Trigger
                render={
                  <a
                    className={buttonRecipe({ variant: "coffee" })}
                    href="https://buymeacoffee.com/lucasfevi"
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t.coffee}
                  />
                }
              >
                <BiCoffee size={16} aria-hidden="true" />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={6}>
                  <Tooltip.Popup>{t.coffee}</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
          <SegmentedToggle
            options={[
              { id: "pt", label: "PT" },
              { id: "en", label: "EN" },
            ]}
            value={lang}
            onChange={(nextLang) => {
              if (nextLang === "pt" || nextLang === "en")
                onLangChange(nextLang);
            }}
            ariaLabel="Language"
          />
        </>
      }
    />
  );
}
