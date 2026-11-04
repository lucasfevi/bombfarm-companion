import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CopyProvider, STRINGS } from "../../lib/copy";
import { StartupSection } from "./startup-section";

function render(
  locale: "en" | "pt-BR",
  props: Partial<Parameters<typeof StartupSection>[0]> = {}
): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale,
      children: createElement(StartupSection, {
        startWithWindows: true,
        onStartWithWindowsChange: () => {},
        persistWarning: null,
        loginItemBlock: null,
        ...props,
      }),
    })
  );
}

/** The opening tag of the element carrying a data-testid. */
function slot(html: string, testid: string): string {
  const at = html.indexOf(`data-testid="${testid}"`);
  expect(at).toBeGreaterThan(-1);
  return html.slice(html.lastIndexOf("<", at), html.indexOf(">", at) + 1);
}

const SLOTS = [
  "settings-start-with-windows-warning",
  "settings-start-with-windows-unpackaged",
  "settings-start-with-windows-failed",
  "settings-start-with-windows-disabled-by-windows",
] as const;

function visibleSlots(html: string): string[] {
  return SLOTS.filter((id) => !slot(html, id).includes("invisible"));
}

/** Markup-escaped copy, so assertions follow the copy maps instead of pinning their wording. */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
const EN = STRINGS.en;
const PT = STRINGS["pt-BR"];

const SWITCH = "settings-start-with-windows-switch";

describe("StartupSection source — no controls of its own and no account access (docs/base-ui-first.md)", () => {
  const source = readFileSync(join(__dirname, "startup-section.tsx"), "utf8");
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  it("no <select>, <input>, <button> or <label> element literal", () => {
    expect(/<(select|input|button|label)\b/.test(stripped)).toBe(false);
  });

  it("reaches for no bridge of its own — the page owns the write", () => {
    expect(source).not.toContain("window.bfc");
  });
});

describe("StartupSection renders the switch with its help, both locales", () => {
  it("the title, label and help differ between English and PT-BR", () => {
    const en = render("en");
    const pt = render("pt-BR");
    expect(en).toContain(esc(EN.settingsStartWithWindowsSectionTitle));
    expect(en).toContain(esc(EN.settingsStartWithWindowsLabel));
    expect(en).toContain(esc(EN.settingsStartWithWindowsHelp));
    expect(pt).toContain(esc(PT.settingsStartWithWindowsSectionTitle));
    expect(pt).toContain(esc(PT.settingsStartWithWindowsLabel));
    expect(pt).toContain(esc(PT.settingsStartWithWindowsHelp));
    expect(pt).not.toContain(esc(EN.settingsStartWithWindowsHelp));
    expect(en).not.toContain(esc(PT.settingsStartWithWindowsHelp));
  });

  it("the help is visible text in the row, not a native title tooltip", () => {
    const html = render("en");
    expect(html).toContain(esc(EN.settingsStartWithWindowsHelp));
    expect(html).not.toContain(
      `title="${esc(EN.settingsStartWithWindowsHelp)}`
    );
  });

  it("reflects the persisted value in both directions", () => {
    expect(slot(render("en", { startWithWindows: true }), SWITCH)).toContain(
      'aria-checked="true"'
    );
    expect(slot(render("en", { startWithWindows: false }), SWITCH)).toContain(
      'aria-checked="false"'
    );
  });

  it("carries role=switch, an aria-label from copy and its data-testid", () => {
    const sw = slot(render("en"), SWITCH);
    expect(sw).toContain('role="switch"');
    expect(sw).toContain(
      `aria-label="${esc(EN.settingsStartWithWindowsLabel)}"`
    );
  });

  it("is enabled when there is no block, and for failed / disabled_by_windows", () => {
    for (const block of [null, "failed", "disabled_by_windows"] as const) {
      const sw = slot(render("en", { loginItemBlock: block }), SWITCH);
      expect(sw).not.toMatch(/\sdisabled(=|\s|>)/);
      expect(sw).not.toContain("data-disabled");
    }
  });
});

describe("StartupSection — unpackaged disables the switch and shows why", () => {
  it.each(["unpackaged", "not_supported"] as const)(
    "%s: switch disabled, reason visible",
    (block) => {
      const html = render("en", { loginItemBlock: block });
      const sw = slot(html, SWITCH);
      expect(/\sdisabled(=|\s|>)|data-disabled/.test(sw)).toBe(true);
      expect(visibleSlots(html)).toEqual([
        "settings-start-with-windows-unpackaged",
      ]);
      expect(html).toContain(esc(EN.settingsStartWithWindowsUnpackagedText));
    }
  );

  it("PT-BR reason renders", () => {
    const html = render("pt-BR", { loginItemBlock: "unpackaged" });
    expect(html).toContain(esc(PT.settingsStartWithWindowsUnpackagedText));
    expect(html).not.toContain(esc(EN.settingsStartWithWindowsUnpackagedText));
    expect(visibleSlots(html)).toEqual([
      "settings-start-with-windows-unpackaged",
    ]);
  });
});

describe("StartupSection — the warning slots are always mounted (docs/no-layout-shift.md rule 1)", () => {
  it("no failure: all four slots are present, empty and hidden", () => {
    const html = render("en");
    for (const id of SLOTS) {
      const tag = slot(html, id);
      expect(tag).toContain('aria-hidden="true"');
      expect(tag).toContain("invisible");
    }
    for (const text of [
      EN.settingsStartWithWindowsUnpackagedText,
      EN.settingsStartWithWindowsFailedText,
      EN.settingsStartWithWindowsDisabledByWindowsText,
    ]) {
      expect(html).not.toContain(esc(text));
    }
    expect(html).not.toContain(esc(EN.settingsLanguageReasonNotWritable));
  });

  it("failed: only its own text shows", () => {
    const html = render("en", { loginItemBlock: "failed" });
    expect(visibleSlots(html)).toEqual(["settings-start-with-windows-failed"]);
    expect(html).toContain(esc(EN.settingsStartWithWindowsFailedText));
    expect(html).not.toContain(
      esc(EN.settingsStartWithWindowsDisabledByWindowsText)
    );
  });

  it("disabled_by_windows: only its own text shows, naming where to turn it back on", () => {
    const html = render("en", { loginItemBlock: "disabled_by_windows" });
    expect(visibleSlots(html)).toEqual([
      "settings-start-with-windows-disabled-by-windows",
    ]);
    expect(html).toContain(
      esc(EN.settingsStartWithWindowsDisabledByWindowsText)
    );
    expect(html).not.toContain(esc(EN.settingsStartWithWindowsFailedText));
  });

  it("not saved: the reason renders under its own title", () => {
    const html = render("en", { persistWarning: "not_writable" });
    expect(visibleSlots(html)).toEqual(["settings-start-with-windows-warning"]);
    expect(html).toContain(esc(EN.settingsStartWithWindowsNotSavedTitle));
    expect(html).toContain(esc(EN.settingsLanguageReasonNotWritable));
  });

  it("not saved and an OS failure render together", () => {
    const html = render("en", {
      persistWarning: "not_writable",
      loginItemBlock: "failed",
    });
    expect(visibleSlots(html)).toEqual([
      "settings-start-with-windows-warning",
      "settings-start-with-windows-failed",
    ]);
    expect(html).toContain(esc(EN.settingsLanguageReasonNotWritable));
    expect(html).toContain(esc(EN.settingsStartWithWindowsFailedText));
  });

  it("PT-BR: the not-saved title and the failure text come from the PT-BR map", () => {
    const html = render("pt-BR", {
      persistWarning: "no_store",
      loginItemBlock: "disabled_by_windows",
    });
    expect(html).toContain(esc(PT.settingsStartWithWindowsNotSavedTitle));
    expect(html).toContain(
      esc(PT.settingsStartWithWindowsDisabledByWindowsText)
    );
    expect(html).not.toContain(
      esc(EN.settingsStartWithWindowsDisabledByWindowsText)
    );
    expect(visibleSlots(html)).toEqual([
      "settings-start-with-windows-warning",
      "settings-start-with-windows-disabled-by-windows",
    ]);
  });
});
