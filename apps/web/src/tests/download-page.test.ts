import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LiveReplica } from '@/features/download/components/live/live-replica';
import { InstallSteps } from '@/features/download/components/install-steps';
import { ReleaseChannels } from '@/features/download/components/release-channels';
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
import { RELEASES_URL } from '@/features/download/model/release';
import { STRINGS, type Lang } from '@/shared/i18n';

const LANGS: readonly Lang[] = ['en', 'pt'];

const RELEASE: LatestRelease = {
  version: '0.7.0-beta.163',
  fileName: 'bombfarm-companion-beta-0.7.0-beta.163-setup.exe',
  downloadUrl:
    'https://github.com/lucasfevi/bombfarm-companion/releases/download/v0.7.0-beta.163/bombfarm-companion-beta-0.7.0-beta.163-setup.exe',
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
      const missing = MIRRORED_KEYS.filter((key) => !markup.includes(liveLabel(key, lang)));
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

  it('picks the most recently published build, not the first listed', () => {
    expect(parseLatestRelease(payload)?.version).toBe('0.7.0-beta.163');
  });

  it('totals downloads across every build, not just the newest', () => {
    expect(parseLatestRelease(payload)?.installs).toBe(6);
  });

  it('reports the asset size in MB', () => {
    expect(parseLatestRelease(payload)?.sizeLabel).toBe('212 MB');
  });

  it('ignores drafts, blockmaps and build logs', () => {
    const noisy = [
      {
        tag_name: 'v9.9.9-beta.1',
        draft: true,
        published_at: '2027-01-01T00:00:00Z',
        assets: [asset('bombfarm-companion-beta-9.9.9-setup.exe', 1)],
      },
      {
        tag_name: 'v0.7.0-beta.163',
        published_at: '2026-08-30T23:37:27Z',
        assets: [
          asset('bombfarm-companion-beta-0.7.0-beta.163-setup.exe.blockmap', 99),
          asset('builder-debug.yml', 99),
          asset('bombfarm-companion-beta-0.7.0-beta.163-setup.exe', 2),
        ],
      },
    ];
    const parsed = parseLatestRelease(noisy);
    expect(parsed?.version).toBe('0.7.0-beta.163');
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

describe('install count strip', () => {
  /**
   * An install count is a whole number of people. The design system's `formatNumber` defaults to
   * one decimal place, which rendered a real count of 6 as "6,0" — a reading that looks like a
   * rate, not a tally.
   */
  it('prints the count as a whole number', () => {
    const markup = renderToStaticMarkup(
      createElement(ReleaseChannels, { t: STRINGS.pt, lang: 'pt', release: RELEASE }),
    );
    expect(markup).toContain('>6<');
    expect(markup).not.toContain('6,0');
  });

  it('hides the strip entirely when the release could not be read', () => {
    const markup = renderToStaticMarkup(
      createElement(ReleaseChannels, { t: STRINGS.en, lang: 'en', release: null }),
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
          { name: 'bombfarm-companion-nightly-0.7.0-setup.exe', size: 1, download_count: 4, browser_download_url: 'https://example.invalid/b' },
          { name: 'bombfarm-companion-beta-0.7.0-beta.163-setup.exe.blockmap', size: 1, download_count: 7, browser_download_url: 'https://example.invalid/c' },
        ],
      },
    ];
    const parsed = parseLatestRelease(across);
    expect(parsed?.installs).toBe(9);
    expect(parsed?.updates).toBe(7);
    // The button still serves this channel, not whichever asset happened to be first.
    expect(parsed?.fileName).toContain('-beta-');
  });

  it('shows the update figure beside the install figure', () => {
    const markup = renderToStaticMarkup(
      createElement(ReleaseChannels, { t: STRINGS.en, lang: 'en', release: RELEASE }),
    );
    expect(markup).toContain('download-update-count');
    expect(markup).toContain(STRINGS.en.downloadUpdatesSuffix);
  });

  it('omits the update figure until an update has actually been delivered', () => {
    const markup = renderToStaticMarkup(
      createElement(ReleaseChannels, { t: STRINGS.en, lang: 'en', release: { ...RELEASE, updates: 0 } }),
    );
    expect(markup).not.toContain('download-update-count');
  });

  it('separates thousands in the reader own convention', () => {
    const many = { ...RELEASE, installs: 4182 };
    const pt = renderToStaticMarkup(
      createElement(ReleaseChannels, { t: STRINGS.pt, lang: 'pt', release: many }),
    );
    const en = renderToStaticMarkup(
      createElement(ReleaseChannels, { t: STRINGS.en, lang: 'en', release: many }),
    );
    expect(pt).toContain('4.182');
    expect(en).toContain('4,182');
  });
});
