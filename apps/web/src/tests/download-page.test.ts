import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LiveReplica } from '@/features/download/components/live/live-replica';
import { InstallSteps } from '@/features/download/components/install-steps';
import { InstallCounts } from '@/features/download/components/install-counts';
import { DownloadHero } from '@/features/download/components/download-hero';
import {
  NAV_SECTIONS,
  SITE_SECTIONS,
  SITE_SECTION_HREF,
  SITE_SECTION_LABEL_KEY,
  isSiteSectionActive,
} from '@/shared/lib/site-sections';
import { MIRRORED_KEYS, liveLabel } from '@/features/download/model/live-replica-copy';
import { LOOP_SECONDS, replicaFrameAt } from '@/features/download/model/live-replica-data';
import {
  DOUBLE_CLICK_LOOP_SECONDS,
  PERMISSION_LOOP_SECONDS,
  doubleClickFrameAt,
  permissionFrameAt,
} from '@/features/download/model/step-illustrations';
import { parseLatestRelease, type LatestRelease } from '@/features/download/model/latest-release';
import { RELEASES_URL, isStableInstaller } from '@/features/download/model/release';
import { STRINGS, type Lang } from '@/shared/i18n';

const LANGS: readonly Lang[] = ['en', 'pt'];

const RELEASE: LatestRelease = {
  version: '0.7.0',
  fileName: 'bombfarm-companion-0.7.0-setup.exe',
  downloadUrl:
    'https://github.com/lucasfevi/bombfarm-companion/releases/download/v0.7.0/bombfarm-companion-0.7.0-setup.exe',
  sizeLabel: '212 MB',
  installs: 6,
  updates: 3,
};


describe('Live replica', () => {
  /**
   * `tools/download-page-drift.test.mjs` guards the mirrored labels against the desktop shell,
   * but only this ties that guard to what a visitor sees: a replica that stopped reading
   * `live-replica-copy.ts` would leave the guard passing over a module nothing renders.
   */
  for (const lang of LANGS) {
    it(`prints every mirrored desktop label in ${lang}`, () => {
      const markup = renderToStaticMarkup(createElement(LiveReplica, { lang }));
      // A templated label reaches the page with its placeholders filled, so match the literal
      // run before the first one — still enough to fail on a reworded or missing label.
      const literalPrefix = (text: string) => text.split('{')[0].trim();
      const missing = MIRRORED_KEYS.filter(
        (key) => !markup.includes(literalPrefix(liveLabel(key, lang))),
      );
      expect(missing).toEqual([]);
    });
  }

  it('follows the language it is handed', () => {
    const en = renderToStaticMarkup(createElement(LiveReplica, { lang: 'en' }));
    const pt = renderToStaticMarkup(createElement(LiveReplica, { lang: 'pt' }));
    expect(en).toContain(liveLabel('liveEarningsTitle', 'en'));
    expect(en).not.toContain(liveLabel('liveEarningsTitle', 'pt'));
    expect(pt).toContain(liveLabel('liveEarningsTitle', 'pt'));
  });

  it('is hidden from assistive technology — the numbers in it are samples', () => {
    const markup = renderToStaticMarkup(createElement(LiveReplica, { lang: 'en' }));
    expect(markup).toContain('aria-hidden="true"');
  });

  /**
   * The desktop's earnings panel gained a trend line and three measured figures while this page
   * was in review. The label mirror caught nothing — the new labels were simply absent here — so
   * this asserts the replica draws the panel the app actually has now.
   */
  it('draws the trend line and the measured figures the earnings panel carries', () => {
    const markup = renderToStaticMarkup(createElement(LiveReplica, { lang: 'en' }));
    expect(markup).toContain('<polyline');
    expect(markup).toContain(liveLabel('liveEarningsMeasuredNote', 'en'));
    expect(markup).toContain(liveLabel('liveEarningsPropsPerMinuteLabel', 'en'));
    expect(markup).toContain(liveLabel('liveEarningsGoldPerPropLabel', 'en'));
  });

  it('reads the measured gold per prop against the map card own estimate', () => {
    const frame = replicaFrameAt(0);
    const expected =
      Math.round(((frame.measured.goldPerProp - frame.map.goldPerProp) / frame.map.goldPerProp) * 1000) / 10;
    expect(frame.measured.goldPerPropDeltaPercent).toBe(expected);
    expect(frame.measured.goldPerProp).toBeLessThan(frame.map.goldPerProp);
  });

  it('marks each row with the way that hero energy is actually moving, not merely with a colour', () => {
    const markup = renderToStaticMarkup(createElement(LiveReplica, { lang: 'en' }));
    const start = replicaFrameAt(0);
    const later = replicaFrameAt(LOOP_SECONDS);
    const movingBy = (sign: number) =>
      start.heroes.filter(
        (hero, index) => Math.sign((later.heroes[index]?.energyPercent ?? 0) - hero.energyPercent) === sign,
      );

    expect(movingBy(-1).length).toBeGreaterThan(0);
    expect(movingBy(1).length).toBeGreaterThan(0);
    expect(markup.match(/▾/g) ?? []).toHaveLength(movingBy(-1).length);
    expect(markup.match(/▴/g) ?? []).toHaveLength(movingBy(1).length);
  });

  it('shows the roster it was drawn from, with an avatar each', () => {
    const markup = renderToStaticMarkup(createElement(LiveReplica, { lang: 'en' }));
    for (const name of ['Bellatrix', 'Jon', 'Minato']) expect(markup).toContain(name);
    expect(markup.match(/<img/g) ?? []).toHaveLength(replicaFrameAt(0).heroes.length);
  });
});

describe('replica loop', () => {
  it('renders frame zero on the server, so hydration cannot disagree', () => {
    const first = renderToStaticMarkup(createElement(LiveReplica, { lang: 'en' }));
    const second = renderToStaticMarkup(createElement(LiveReplica, { lang: 'en' }));
    expect(first).toBe(second);
    expect(first).toContain(replicaFrameAt(0).earnings.elapsed);
  });

  it('moves the readings a player would watch move', () => {
    const start = replicaFrameAt(0);
    const end = replicaFrameAt(LOOP_SECONDS);

    expect(end.earnings.elapsed).not.toBe(start.earnings.elapsed);
    expect(end.map.propsAlive).toBeLessThan(start.map.propsAlive);
    expect(end.heroes[0].countdown).not.toBe(start.heroes[0].countdown);
  });

  it('empties the map at a point a second or better', () => {
    const dropped = replicaFrameAt(0).map.healthPercent - replicaFrameAt(1).map.healthPercent;
    expect(dropped).toBeGreaterThanOrEqual(1);
  });

  /** Gold and XP sat still for a whole loop because they were fixed strings, not readings. */
  it('grows gold and XP as the map is cleared', () => {
    const start = replicaFrameAt(0);
    const end = replicaFrameAt(LOOP_SECONDS);

    expect(end.earnings.goldSessionTotal).toBeGreaterThan(start.earnings.goldSessionTotal);
    expect(end.earnings.currentGold).toBeGreaterThan(start.earnings.currentGold);
    expect(end.earnings.xpSessionTotal).toBeGreaterThan(start.earnings.xpSessionTotal);
  });

  it('pays out of the map it is clearing, rather than from an unrelated counter', () => {
    const start = replicaFrameAt(0);
    const end = replicaFrameAt(LOOP_SECONDS);

    const clearedFraction = (start.map.healthPercent - end.map.healthPercent) / 100;
    const goldEarned = end.earnings.goldSessionTotal - start.earnings.goldSessionTotal;
    expect(goldEarned).toBe(Math.round(start.map.goldPerClear * clearedFraction));

    const propsDestroyed = start.map.propsAlive - end.map.propsAlive;
    const xpEarned = end.earnings.xpSessionTotal - start.earnings.xpSessionTotal;
    expect(xpEarned).toBe(propsDestroyed * start.map.xpPerProp);
  });

  it('counts field time down, drains field energy and refills rest energy', () => {
    const start = replicaFrameAt(0);
    const end = replicaFrameAt(LOOP_SECONDS);
    const onField = (frame: typeof start) => frame.heroes.find((hero) => hero.state === 'on-field');
    const resting = (frame: typeof start) =>
      frame.heroes.find((hero) => hero.state === 'recovering');

    const seconds = (clock: string | undefined) => {
      const [minutes, secs] = (clock ?? '0:0').split(':');
      return Number(minutes) * 60 + Number(secs);
    };
    expect(seconds(end.heroes[0].countdown)).toBe(seconds(start.heroes[0].countdown) - LOOP_SECONDS);
    expect(onField(end)?.energyPercent).toBeLessThan(onField(start)?.energyPercent ?? 0);
    expect(resting(end)?.energyPercent).toBeGreaterThan(resting(start)?.energyPercent ?? 100);
  });

  it('is a pure function of the second it is asked for', () => {
    expect(replicaFrameAt(7.5)).toEqual(replicaFrameAt(7.5));
  });

  it('never runs an energy reading past its bounds', () => {
    for (let t = 0; t <= LOOP_SECONDS; t += 0.5) {
      for (const hero of replicaFrameAt(t).heroes) {
        expect(hero.energyPercent).toBeGreaterThanOrEqual(0);
        expect(hero.energyPercent).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('install steps', () => {
  for (const lang of LANGS) {
    it(`names the installer and both SmartScreen buttons in ${lang}`, () => {
      const t = STRINGS[lang];
      const markup = renderToStaticMarkup(
        createElement(InstallSteps, { t, fileName: RELEASE.fileName }),
      );
      expect(markup).toContain(RELEASE.fileName);
      expect(markup).toContain(t.downloadSmartRunAnyway);
      expect(markup).toContain(t.downloadSmartMore);
    });
  }

  it('reads without a filename before GitHub answers', () => {
    const markup = renderToStaticMarkup(
      createElement(InstallSteps, { t: STRINGS.en, fileName: null }),
    );
    expect(markup).toContain(STRINGS.en.downloadInstallerGenericName);
    expect(markup).not.toContain('{file}');
  });

  /**
   * "Run anyway" does not exist on the Windows dialog until "More info" is clicked, which is the
   * single fact this page exists to carry. A step that names only the visible button sends people
   * to a screen with no way forward.
   */
  for (const lang of LANGS) {
    it(`tells the reader to click "More info" before "Run anyway" in ${lang}`, () => {
      const body = STRINGS[lang].downloadStepWarnBody;
      expect(body).toContain(STRINGS[lang].downloadSmartMore);
      expect(body).toContain(STRINGS[lang].downloadSmartRunAnyway);
    });
  }
});

describe('step illustrations', () => {
  it('freeze at a complete first frame, so reduced motion still shows the whole picture', () => {
    const click = doubleClickFrameAt(0);
    const permission = permissionFrameAt(0);
    expect(click.pressed).toBe(false);
    expect(permission.allowed).toBe(true);
  });

  it('double-click: the cursor travels to the file and presses twice', () => {
    const presses: boolean[] = [];
    for (let at = 0; at <= DOUBLE_CLICK_LOOP_SECONDS; at += 0.05) {
      presses.push(doubleClickFrameAt(at).pressed);
    }
    const downs = presses.filter((pressed, index) => pressed && !presses[index - 1]).length;
    expect(downs).toBe(2);
    // It ends on the target: zero offset from the element it is anchored to.
    expect(Math.abs(doubleClickFrameAt(DOUBLE_CLICK_LOOP_SECONDS).offsetX)).toBeLessThan(0.5);
    expect(Math.abs(doubleClickFrameAt(DOUBLE_CLICK_LOOP_SECONDS).offsetY)).toBeLessThan(0.5);
    expect(doubleClickFrameAt(0).offsetX).toBeGreaterThan(0);
  });

  /** The withdrawn beat is the point of the drawing — it shows what the app does without it. */
  it('permission: the switch is turned off and back on', () => {
    const states = [];
    for (let at = 0; at <= PERMISSION_LOOP_SECONDS; at += 0.1) {
      states.push(permissionFrameAt(at).allowed);
    }
    expect(states).toContain(true);
    expect(states).toContain(false);
    expect(states[0]).toBe(true);
    expect(states[states.length - 1]).toBe(true);
  });

  it('permission: the cursor arrives on the switch before it flips', () => {
    const atFlip = permissionFrameAt(1.1);
    expect(Math.abs(atFlip.offsetX)).toBeLessThan(1);
    expect(Math.abs(atFlip.offsetY)).toBeLessThan(1);
  });

  it('says plainly that the app does not work without the permission', () => {
    for (const lang of LANGS) {
      expect(STRINGS[lang].downloadStepPermissionRequirement.length).toBeGreaterThan(20);
    }
    const markup = renderToStaticMarkup(
      createElement(InstallSteps, { t: STRINGS.en, fileName: null }),
    );
    expect(markup).toContain(STRINGS.en.downloadStepPermissionRequirement);
    expect(markup).toContain(STRINGS.en.downloadPermissionRowLabel);
  });

  it('names both reasons Windows or an antivirus may object', () => {
    const markup = renderToStaticMarkup(
      createElement(InstallSteps, { t: STRINGS.en, fileName: null }),
    );
    expect(markup).toContain(STRINGS.en.downloadWhySmartScreenTitle);
    expect(markup).toContain(STRINGS.en.downloadWhyAntivirusTitle);
  });
});

describe('the download link', () => {
  /**
   * The first version of this page hardcoded a version, a filename and a size. All three were
   * wrong within a day and the button 404'd, so nothing about a release is written down now.
   */
  it('falls back to the releases page before GitHub answers — never a guessed asset URL', () => {
    const markup = renderToStaticMarkup(
      createElement(DownloadHero, { t: STRINGS.en, lang: 'en', release: null }),
    );
    expect(markup).toContain(`href="${RELEASES_URL}"`);
    expect(markup).not.toContain('/releases/download/');
  });

  it('points at the resolved asset once GitHub answers', () => {
    const markup = renderToStaticMarkup(
      createElement(DownloadHero, { t: STRINGS.en, lang: 'en', release: RELEASE }),
    );
    expect(markup).toContain(`href="${RELEASE.downloadUrl}"`);
    expect(markup).toContain(RELEASE.version);
    expect(markup).toContain(RELEASE.sizeLabel);
  });

  it('states no version or size until it knows one', () => {
    const markup = renderToStaticMarkup(
      createElement(DownloadHero, { t: STRINGS.en, lang: 'en', release: null }),
    );
    expect(markup).not.toMatch(/v\d+\.\d+\.\d+/);
    expect(markup).not.toMatch(/\d+ MB/);
  });
});

describe('recognising a stable installer', () => {
  /**
   * electron-builder names the stable installer from the bare product name and every other
   * flavor from a suffixed one, so stable is the case with nothing to match on. It is matched
   * positively — a digit follows the product name — rather than as "not one of the others",
   * which would quietly adopt a channel added later as stable.
   */
  it('accepts a name whose version follows the product name directly', () => {
    expect(isStableInstaller('bombfarm-companion-0.7.1-setup.exe')).toBe(true);
    expect(isStableInstaller('bombfarm-companion-1.10.2-setup.exe')).toBe(true);
  });

  it('rejects every other flavor, named or not yet invented', () => {
    expect(isStableInstaller('bombfarm-companion-beta-0.7.1-beta.170-setup.exe')).toBe(false);
    expect(isStableInstaller('bombfarm-companion-dev-0.7.1-setup.exe')).toBe(false);
    expect(isStableInstaller('bombfarm-companion-canary-0.7.1-setup.exe')).toBe(false);
  });

  it('rejects everything that is not an installer', () => {
    expect(isStableInstaller('bombfarm-companion-0.7.1-setup.exe.blockmap')).toBe(false);
    expect(isStableInstaller('builder-debug.yml')).toBe(false);
    expect(isStableInstaller('latest.yml')).toBe(false);
  });
});

describe('resolving the newest build', () => {
  const asset = (name: string, downloads: number) => ({
    name,
    size: 221_979_203,
    download_count: downloads,
    browser_download_url: `https://example.invalid/${name}`,
  });

  const payload = [
    {
      tag_name: 'v0.6.0-beta.161',
      published_at: '2026-08-30T21:56:50Z',
      assets: [asset('bombfarm-companion-beta-0.6.0-beta.161-setup.exe', 4)],
    },
    {
      tag_name: 'v0.7.0-beta.163',
      published_at: '2026-08-30T23:37:27Z',
      assets: [asset('bombfarm-companion-beta-0.7.0-beta.163-setup.exe', 2)],
    },
  ];

  const withStable = [
    ...payload,
    {
      tag_name: 'v0.7.0',
      published_at: '2026-08-31T09:00:00Z',
      assets: [asset('bombfarm-companion-0.7.0-setup.exe', 1)],
    },
  ];

  it('resolves nothing at all while only betas exist', () => {
    expect(parseLatestRelease(payload)).toBeNull();
  });

  /**
   * Stable is the only thing this page serves. It carries no channel word in its filename —
   * beta's does — so the installer is recognised by the version starting straight after the
   * product name.
   */
  it('serves the stable build once one exists', () => {
    const parsed = parseLatestRelease(withStable);
    expect(parsed?.version).toBe('0.7.0');
    expect(parsed?.fileName).toBe('bombfarm-companion-0.7.0-setup.exe');
  });

  /**
   * A beta published after the newest stable is the normal state of this rail — every merge to
   * `develop` cuts one — and must never take the button.
   */
  it('ignores a beta published more recently than the stable build', () => {
    const betaIsNewer = [
      {
        tag_name: 'v0.7.0',
        published_at: '2026-08-31T09:00:00Z',
        assets: [asset('bombfarm-companion-0.7.0-setup.exe', 1)],
      },
      {
        tag_name: 'v0.8.0-beta.170',
        published_at: '2026-09-02T09:00:00Z',
        assets: [asset('bombfarm-companion-beta-0.8.0-beta.170-setup.exe', 1)],
      },
    ];
    expect(parseLatestRelease(betaIsNewer)?.version).toBe('0.7.0');
  });

  /**
   * The install figure is the one number here that is deliberately not stable-only: it counts
   * every installer anyone has ever downloaded, betas included, because it is a tally of people
   * who installed the app rather than a property of the build on offer.
   */
  it('totals downloads across every build, betas included', () => {
    expect(parseLatestRelease(withStable)?.installs).toBe(7);
  });

  it('reports the asset size in MB', () => {
    expect(parseLatestRelease(withStable)?.sizeLabel).toBe('212 MB');
  });

  it('ignores drafts, blockmaps and build logs', () => {
    const noisy = [
      {
        tag_name: 'v9.9.9',
        draft: true,
        published_at: '2027-01-01T00:00:00Z',
        assets: [asset('bombfarm-companion-9.9.9-setup.exe', 1)],
      },
      {
        tag_name: 'v0.7.0',
        published_at: '2026-08-31T09:00:00Z',
        assets: [
          asset('bombfarm-companion-0.7.0-setup.exe.blockmap', 99),
          asset('builder-debug.yml', 99),
          asset('bombfarm-companion-0.7.0-setup.exe', 2),
        ],
      },
    ];
    const parsed = parseLatestRelease(noisy);
    expect(parsed?.version).toBe('0.7.0');
    expect(parsed?.installs).toBe(2);
  });

  it('gives up rather than guessing when the payload is unusable', () => {
    expect(parseLatestRelease(null)).toBeNull();
    expect(parseLatestRelease({ message: 'API rate limit exceeded' })).toBeNull();
    expect(parseLatestRelease([{ tag_name: 'v1', assets: [] }])).toBeNull();
  });
});

describe('site navigation', () => {
  /**
   * `/download` shipped unreachable: it lived outside the app shell with a header of its own, and
   * nothing added it to the shell's nav. It is a section of the app now, and the nav and the
   * shell's own "is this a section page?" check both read this one list — a section missing from
   * it is a route that renders nothing.
   */
  it('offers the download page as a destination', () => {
    expect(SITE_SECTIONS).toContain('download');
    expect(SITE_SECTION_HREF.download).toBe('/download');
  });

  /**
   * The shell renders `children` only for a path it recognises as a section, so `/download` has
   * to stay in `SITE_SECTIONS` even though it is reached from the header's primary button rather
   * than from a nav tab. Dropping it from the route list to take it out of the nav would leave
   * the route rendering the planner slot instead of the page.
   */
  it('keeps the download route out of the nav tabs but inside the section list', () => {
    expect(NAV_SECTIONS).not.toContain('download');
    expect(SITE_SECTIONS).toContain('download');
    expect(NAV_SECTIONS.every((section) => SITE_SECTIONS.includes(section))).toBe(true);
  });

  it('names the header call to action in both languages', () => {
    expect(STRINGS.en.downloadHeaderCta).toContain('BombFarm Companion');
    expect(STRINGS.pt.downloadHeaderCta).toContain('BombFarm Companion');
  });

  it('gives every section an href and a label in both languages', () => {
    for (const section of SITE_SECTIONS) {
      expect(SITE_SECTION_HREF[section]).toMatch(/^\//);
      expect(STRINGS.en[SITE_SECTION_LABEL_KEY[section]]).toBeTruthy();
      expect(STRINGS.pt[SITE_SECTION_LABEL_KEY[section]]).toBeTruthy();
    }
  });

  it('treats only the planner as an exact-path section', () => {
    expect(isSiteSectionActive('planner', '/')).toBe(true);
    expect(isSiteSectionActive('planner', '/farm')).toBe(false);
    expect(isSiteSectionActive('download', '/download')).toBe(true);
    expect(isSiteSectionActive('download', '/')).toBe(false);
  });
});

describe('what the page offers', () => {
  /**
   * The page used to be a menu of channels: a chip naming the resolved one, and a card each for
   * stable and beta. It offers one download now, so no channel may be named anywhere — and
   * nothing may quietly serve a build from a channel the page cannot mention.
   */
  it('names no channel beside the button or in the file line', () => {
    const markup = renderToStaticMarkup(
      createElement(DownloadHero, { t: STRINGS.en, lang: 'en', release: RELEASE }),
    );
    expect(markup).not.toContain('download-channel-chip');
    expect(markup).not.toContain('Stable');
    expect(markup).not.toContain('Beta');
    expect(markup).not.toContain('{channel}');
  });

  /**
   * A beta installer carries its channel in its own filename, so serving one would put the word
   * "beta" on a page that has no way to explain it. `parseLatestRelease` refuses to resolve one
   * at all; this asserts the refusal at the surface the visitor actually clicks.
   */
  it('offers no build at all rather than a beta one', () => {
    const betaOnly = [
      {
        tag_name: 'v0.7.1-beta.170',
        published_at: '2026-08-31T17:34:18Z',
        assets: [
          {
            name: 'bombfarm-companion-beta-0.7.1-beta.170-setup.exe',
            size: 221_979_203,
            download_count: 3,
            browser_download_url: 'https://example.invalid/beta',
          },
        ],
      },
    ];
    expect(parseLatestRelease(betaOnly)).toBeNull();

    const markup = renderToStaticMarkup(
      createElement(DownloadHero, { t: STRINGS.en, lang: 'en', release: null }),
    );
    expect(markup).toContain(`href="${RELEASES_URL}"`);
    expect(markup).not.toContain('/releases/download/');
  });

  it('shows no channel cards', () => {
    const markup = renderToStaticMarkup(
      createElement(InstallCounts, { t: STRINGS.en, lang: 'en', release: RELEASE }),
    );
    expect(markup).not.toContain('Stable');
    expect(markup).not.toContain('Beta');
    expect(markup).toContain('download-install-count');
  });
});

describe('install count strip', () => {
  /**
   * An install count is a whole number of people. The design system's `formatNumber` defaults to
   * one decimal place, which rendered a real count of 6 as "6,0" — a reading that looks like a
   * rate, not a tally.
   */
  it('prints the count as a whole number', () => {
    const markup = renderToStaticMarkup(
      createElement(InstallCounts, { t: STRINGS.pt, lang: 'pt', release: RELEASE }),
    );
    expect(markup).toContain('>6<');
    expect(markup).not.toContain('6,0');
  });

  it('hides the strip entirely when the release could not be read', () => {
    const markup = renderToStaticMarkup(
      createElement(InstallCounts, { t: STRINGS.en, lang: 'en', release: null }),
    );
    expect(markup).not.toContain('download-install-count');
    expect(markup).not.toContain(STRINGS.en.downloadInstallsSuffix);
  });

  /**
   * Installs count every installer on every channel; updates count only `.blockmap` fetches,
   * which nothing but electron-updater asks for. Mixing them would inflate installs with the
   * same people coming back.
   */
  it('counts installs across every channel and version', () => {
    const across = [
      {
        tag_name: 'v0.7.0-beta.163',
        published_at: '2026-08-30T23:37:27Z',
        assets: [
          { name: 'bombfarm-companion-beta-0.7.0-beta.163-setup.exe', size: 1, download_count: 5, browser_download_url: 'https://example.invalid/a' },
          { name: 'bombfarm-companion-beta-0.7.0-beta.163-setup.exe.blockmap', size: 1, download_count: 7, browser_download_url: 'https://example.invalid/c' },
        ],
      },
      {
        tag_name: 'v0.7.0',
        published_at: '2026-08-31T09:00:00Z',
        assets: [
          { name: 'bombfarm-companion-0.7.0-setup.exe', size: 1, download_count: 4, browser_download_url: 'https://example.invalid/b' },
        ],
      },
    ];
    const parsed = parseLatestRelease(across);
    expect(parsed?.installs).toBe(9);
    expect(parsed?.updates).toBe(7);
    // The button serves the stable build, not whichever asset happened to be first.
    expect(parsed?.fileName).toBe('bombfarm-companion-0.7.0-setup.exe');
  });

  it('shows the update figure beside the install figure', () => {
    const markup = renderToStaticMarkup(
      createElement(InstallCounts, { t: STRINGS.en, lang: 'en', release: RELEASE }),
    );
    expect(markup).toContain('download-update-count');
    expect(markup).toContain(STRINGS.en.downloadUpdatesSuffix);
  });

  it('omits the update figure until an update has actually been delivered', () => {
    const markup = renderToStaticMarkup(
      createElement(InstallCounts, { t: STRINGS.en, lang: 'en', release: { ...RELEASE, updates: 0 } }),
    );
    expect(markup).not.toContain('download-update-count');
  });

  it('separates thousands in the reader own convention', () => {
    const many = { ...RELEASE, installs: 4182 };
    const pt = renderToStaticMarkup(
      createElement(InstallCounts, { t: STRINGS.pt, lang: 'pt', release: many }),
    );
    const en = renderToStaticMarkup(
      createElement(InstallCounts, { t: STRINGS.en, lang: 'en', release: many }),
    );
    expect(pt).toContain('4.182');
    expect(en).toContain('4,182');
  });
});
