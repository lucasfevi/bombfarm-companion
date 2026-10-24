import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildManifest,
  CSP_MANIFEST_FILE,
  CspManifestError,
  cspHash,
  hashesForPage,
  readExportedPages,
  scanHtml,
  verifyManifest,
  verifyManifestOnDisk,
  writeManifest,
} from './csp-manifest.mjs';
import { documentPolicy, parseCspManifest } from '../src/main/renderer-csp.ts';

const sha256 = (text) => `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;
const page = (body, head = '') => `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;

describe('cspHash', () => {
  it('is the base64 SHA-256 of the script text, prefixed for a CSP source list', () => {
    expect(cspHash('')).toBe('sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
    expect(cspHash('self.__next_f.push([0])')).toBe(sha256('self.__next_f.push([0])'));
  });

  it('hashes CRLF text as the LF text the HTML parser hands the browser', () => {
    expect(cspHash('a();\r\nb();\rc();')).toBe(sha256('a();\nb();\nc();'));
  });
});

describe('scanHtml: inline scripts', () => {
  it('collects the text of each inline script and skips external ones', () => {
    const scan = scanHtml(page('<script>one()</script><script src="/a.js" async=""></script><script>two()</script>'));
    expect(scan.scripts).toEqual(['one()', 'two()']);
    expect(scan.problems).toEqual([]);
  });

  it('ignores a script that carries a src attribute even when it also has a body', () => {
    expect(scanHtml(page('<script src="/a.js">ignored()</script>')).scripts).toEqual([]);
  });

  it('reads the script past a quoted ">" in an attribute', () => {
    expect(scanHtml(page('<script data-x=">" id=a>real()</script>')).scripts).toEqual(['real()']);
  });

  it('reads upper-case tags and a closing tag with trailing whitespace', () => {
    expect(scanHtml(page('<SCRIPT>upper()</SCRIPT >')).scripts).toEqual(['upper()']);
  });

  it('keeps going past a close-tag lookalike that is not a close tag', () => {
    expect(scanHtml(page('<script>var s = "</scripts>"; done()</script>')).scripts).toEqual(['var s = "</scripts>"; done()']);
  });

  it('does not see a script inside a comment', () => {
    expect(scanHtml(page('<!-- <script>hidden()</script> --><script>shown()</script>')).scripts).toEqual(['shown()']);
  });

  it.each(['<!-->', '<!--->'])('ends a comment written as %s', (opener) => {
    expect(scanHtml(page(`${opener}<script>after()</script>`)).scripts).toEqual(['after()']);
  });

  it('ends a comment on --!> as well as -->', () => {
    expect(scanHtml(page('<!-- a --!><script>after()</script>')).scripts).toEqual(['after()']);
  });

  it.each(['title', 'textarea', 'noscript', 'iframe', 'xmp'])('does not see a script inside <%s>', (element) => {
    const scan = scanHtml(page(`<${element}><script>x()</script></${element}><script>y()</script>`));
    expect(scan.scripts).toEqual(['y()']);
  });

  it('keeps an inline module script', () => {
    expect(scanHtml(page('<script type="module">import("./a.js")</script>')).scripts).toEqual(['import("./a.js")']);
  });

  it('keeps the first of a repeated attribute, as the parser does', () => {
    expect(scanHtml(page('<script src="/a.js" src2 SRC="">body()</script>')).scripts).toEqual([]);
  });
});

describe('scanHtml: what it refuses to guess at', () => {
  it.each([
    ['an escaped script-data state', '<script>var a = "<!--"; </script>'],
    ['a CDATA section', '<svg><![CDATA[ x ]]></svg>'],
    ['a script inside svg', '<svg><script>x()</script></svg>'],
    ['a style inside math', '<math><style>x</style></math>'],
    ['an unterminated script', '<script>x()'],
    ['an unterminated start tag', '<div class="a'],
    ['an unterminated end tag', '</div class="'],
    ['plaintext', '<plaintext><script>x()</script>'],
    ['an iframe', '<iframe src="/a.html"></iframe>'],
    ['an object', '<object data="/a.swf"></object>'],
  ])('fails on %s', (_name, body) => {
    expect(scanHtml(page(body)).problems.length).toBeGreaterThan(0);
  });

  it('allows an inline svg of shapes', () => {
    expect(scanHtml(page('<svg viewBox="0 0 1 1"><rect width="1"></rect><circle r="2"/></svg><script>x()</script>')).problems).toEqual([]);
  });

  it('allows an accessible svg title and still sees the script after it', () => {
    const scan = scanHtml(page('<svg><title>Bomb</title><rect/></svg><script>x()</script>'));
    expect(scan.problems).toEqual([]);
    expect(scan.scripts).toEqual(['x()']);
  });

  it('allows a script after a self-closing svg', () => {
    expect(scanHtml(page('<svg/><script>x()</script>')).problems).toEqual([]);
  });
});

describe('scanHtml: attributes the policy can never allow', () => {
  it.each(['onclick', 'onload', 'ONERROR', 'onmouseover'])('rejects the %s handler', (name) => {
    const scan = scanHtml(page(`<img src="/a.png" ${name}="x()">`));
    expect(scan.problems).toEqual([expect.stringContaining('event handler')]);
  });

  it('rejects a handler on a bare attribute with no value', () => {
    expect(scanHtml(page('<div onclick></div>')).problems.length).toBe(1);
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' \tjava\nscript:alert(1)',
    '&#106;avascript:alert(1)',
    '&#x6A;avascript:alert(1)',
  ])('rejects the URL %j', (url) => {
    const scan = scanHtml(page(`<a href="${url}">x</a>`));
    expect(scan.problems).toEqual([expect.stringContaining('javascript: URL')]);
  });

  it('rejects a character reference it cannot decode rather than hash a guess', () => {
    expect(scanHtml(page('<a href="java&colon;script:alert(1)">x</a>')).problems.length).toBe(1);
  });

  it.each(['src', 'action', 'formaction', 'poster', 'xlink:href'])('checks %s for a javascript: URL', (attribute) => {
    expect(scanHtml(page(`<x ${attribute}="javascript:1"></x>`)).problems.length).toBe(1);
  });

  it('accepts an ordinary link', () => {
    expect(scanHtml(page('<a href="https://example.com/?a=1&amp;b=2">x</a>')).problems).toEqual([]);
  });
});

describe('scanHtml: styles', () => {
  it('collects style elements and decoded style attribute values', () => {
    const scan = scanHtml(page('<div style="font-family:&quot;A&quot;;a:b&amp;c"></div><style>.x{color:red}</style>'));
    expect(scan.styleAttributes).toEqual(['font-family:"A";a:b&c']);
    expect(scan.styleElements).toEqual(['.x{color:red}']);
  });

  it('collects a style attribute on an svg element', () => {
    expect(scanHtml(page('<svg><rect style="fill:red"></rect></svg>')).styleAttributes).toEqual(['fill:red']);
  });
});

describe('buildManifest and verifyManifest', () => {
  const pages = new Map([
    ['index.html', page('<script>one()</script><script>one()</script><div style="a:b"></div>')],
    ['sub/index.html', page('<script>two()</script>')],
  ]);

  it('records sorted, de-duplicated hashes for every page', () => {
    const manifest = buildManifest(pages);
    expect(Object.keys(manifest.pages)).toEqual(['index.html', 'sub/index.html']);
    expect(manifest.pages['index.html']).toEqual({
      scripts: [sha256('one()')],
      styleElements: [],
      styleAttributes: [sha256('a:b')],
    });
    expect(manifest.pages['sub/index.html'].scripts).toEqual([sha256('two()')]);
  });

  it('refuses to build when a page carries something the policy cannot allow', () => {
    const bad = new Map([...pages, ['bad.html', page('<button onclick="x()"></button>')]]);
    expect(() => buildManifest(bad)).toThrow(CspManifestError);
    expect(() => buildManifest(bad)).toThrow(/bad\.html: an inline event handler/);
  });

  it('passes a manifest that matches the pages it was built from', () => {
    expect(() => verifyManifest(buildManifest(pages), pages)).not.toThrow();
  });

  it('fails when a page gains an inline script the manifest does not hash', () => {
    const manifest = buildManifest(pages);
    const edited = new Map(pages).set('index.html', page('<script>one()</script><script>injected()</script><div style="a:b"></div>'));
    expect(() => verifyManifest(manifest, edited)).toThrow(/index\.html: inline scripts hash sha256-.* is not in the manifest/);
  });

  it('fails when an inline script changes by one character', () => {
    const manifest = buildManifest(pages);
    const edited = new Map(pages).set('sub/index.html', page('<script>two() </script>'));
    expect(() => verifyManifest(manifest, edited)).toThrow(/is not in the manifest/);
    expect(() => verifyManifest(manifest, edited)).toThrow(/manifest scripts hash .* matches nothing/);
  });

  it('fails when a manifest hash no longer matches any script', () => {
    const manifest = buildManifest(pages);
    const edited = new Map(pages).set('index.html', page('<div style="a:b"></div>'));
    expect(() => verifyManifest(manifest, edited)).toThrow(/manifest scripts hash .* matches nothing in the page/);
  });

  it('fails when a style attribute is added after the manifest was written', () => {
    const manifest = buildManifest(pages);
    const edited = new Map(pages).set('sub/index.html', page('<script>two()</script><p style="x:y"></p>'));
    expect(() => verifyManifest(manifest, edited)).toThrow(/styleAttributes hash .* is not in the manifest/);
  });

  it('fails when a page is missing from the manifest, or the manifest lists a page that is gone', () => {
    const manifest = buildManifest(pages);
    expect(() => verifyManifest(manifest, new Map([...pages, ['extra.html', page('')]]))).toThrow(/extra\.html: in the export but missing/);
    expect(() => verifyManifest(manifest, new Map([...pages].slice(0, 1)))).toThrow(/sub\/index\.html: listed in the manifest but not in the export/);
  });

  it('fails when the page now holds an event handler even if every hash still matches', () => {
    const manifest = buildManifest(pages);
    const edited = new Map(pages).set('sub/index.html', page('<script>two()</script><b onclick="x()"></b>'));
    expect(() => verifyManifest(manifest, edited)).toThrow(/inline event handler/);
  });

  it('rejects a manifest that is not the expected shape', () => {
    expect(() => verifyManifest({ version: 2, pages: {} }, pages)).toThrow(CspManifestError);
    expect(() => verifyManifest(null, pages)).toThrow(CspManifestError);
  });
});

describe('the manifest on disk', () => {
  let outDir;
  beforeEach(() => {
    outDir = mkdtempSync(path.join(os.tmpdir(), 'bfc-csp-manifest-'));
  });
  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  const write = (relativePath, content) => {
    const target = path.join(outDir, ...relativePath.split('/'));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  };

  it('is written beside the pages it describes and verifies clean', () => {
    write('index.html', page('<script>one()</script>'));
    write('mini-live/index.html', page('<script>two()</script>'));
    write('_next/static/app.js', 'ignored');
    const manifest = writeManifest(outDir);
    expect(Object.keys(manifest.pages)).toEqual(['index.html', 'mini-live/index.html']);
    expect(() => verifyManifestOnDisk(outDir)).not.toThrow();
  });

  it('fails verification once a page is edited after the manifest was written', () => {
    write('index.html', page('<script>one()</script>'));
    writeManifest(outDir);
    write('index.html', page('<script>one()</script><script>sneaked()</script>'));
    expect(() => verifyManifestOnDisk(outDir)).toThrow(/is not in the manifest/);
  });

  it('fails verification once a hash in the manifest is tampered with', () => {
    write('index.html', page('<script>one()</script>'));
    writeManifest(outDir);
    const manifestPath = path.join(outDir, CSP_MANIFEST_FILE);
    const tampered = JSON.parse(readFileSync(manifestPath, 'utf8'));
    tampered.pages['index.html'].scripts.push(sha256('attacker()'));
    writeFileSync(manifestPath, JSON.stringify(tampered));
    expect(() => verifyManifestOnDisk(outDir)).toThrow(/matches nothing in the page/);
  });

  it('refuses an export with no HTML at all', () => {
    write('_next/static/app.js', 'x');
    expect(() => writeManifest(outDir)).toThrow(/no HTML files/);
  });

  it('refuses to write when a page holds an inline event handler', () => {
    write('index.html', page('<a onclick="x()">x</a>'));
    expect(() => writeManifest(outDir)).toThrow(/inline event handler/);
  });
});

describe('the manifest and the policy the main process builds from it', () => {
  it('puts every hash the build recorded into that page\'s script-src, and nothing else', () => {
    const pages = new Map([
      ['index.html', page('<script>one()</script><div style="a:b"></div>')],
      ['mini-live/index.html', page('<script>two()</script>')],
    ]);
    const manifest = parseCspManifest(JSON.parse(JSON.stringify(buildManifest(pages))));

    const indexPolicy = documentPolicy(manifest.pages.get('index.html'));
    expect(indexPolicy).toContain(`script-src 'self' '${sha256('one()')}';`);
    expect(indexPolicy).not.toContain(sha256('two()'));
    expect(indexPolicy).toContain(`style-src-attr 'unsafe-hashes' '${sha256('a:b')}'`);

    const miniPolicy = documentPolicy(manifest.pages.get('mini-live/index.html'));
    expect(miniPolicy).toContain(`script-src 'self' '${sha256('two()')}';`);
    expect(miniPolicy).toContain("style-src-attr 'none'");
  });

  it('matches the hashes of a page shaped like a Next static export', () => {
    const html = page(
      '<script>(self.__next_f=self.__next_f||[]).push([0])</script><script>self.__next_f.push([1,"1:\\"$Sreact.fragment\\"\\n"])</script>',
      '<script src="/_next/static/chunks/a.js" async=""></script>',
    );
    const { page: hashed, problems } = hashesForPage(html);
    expect(problems).toEqual([]);
    expect(hashed.scripts).toEqual(
      [
        '(self.__next_f=self.__next_f||[]).push([0])',
        'self.__next_f.push([1,"1:\\"$Sreact.fragment\\"\\n"])',
      ]
        .map(sha256)
        .sort(),
    );
  });
});

/**
 * A second, deliberately naive way to find the inline scripts of a page: split on the literal
 * `<script`, drop the ones whose opening tag carries `src=`, and take the text up to `</script`.
 * It shares no code with the scanner that writes, verifies and gates the manifest, so a scanner
 * that drops or truncates a script cannot also fool this.
 */
function naiveInlineScriptTexts(html) {
  return html
    .split('<script')
    .slice(1)
    .filter((chunk) => !/\ssrc=/.test(chunk.slice(0, chunk.indexOf('>'))))
    .map((chunk) => chunk.slice(chunk.indexOf('>') + 1, chunk.indexOf('</script')));
}

describe('the scanner against a naive second count', () => {
  const longScript = `self.__next_f.push([1,"${'x'.repeat(4000)}"])`;
  const fixture = page(
    [
      '<script>short()</script>',
      '<script src="/_next/a.js" async=""></script>',
      `<script>${longScript}</script>`,
      '<script type="module">import("./m.js")</script>',
      `<script>${'y'.repeat(600)}</script>`,
    ].join(''),
  );

  it('finds as many inline scripts as the naive count, long ones included', () => {
    const naive = naiveInlineScriptTexts(fixture);
    expect(naive).toHaveLength(4);
    expect(scanHtml(fixture).scripts).toHaveLength(naive.length);
  });

  it('hashes exactly the texts the naive count found', () => {
    const hashed = hashesForPage(fixture).page.scripts;
    expect(hashed).toEqual([...new Set(naiveInlineScriptTexts(fixture).map(sha256))].sort());
  });

  it('agrees on every page of the real renderer export when it has been built', () => {
    const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'renderer', 'out');
    const pages = existsSync(outDir) ? readExportedPages(outDir) : new Map();
    for (const [relativePath, html] of pages) {
      const naive = naiveInlineScriptTexts(html);
      expect(scanHtml(html).scripts, relativePath).toHaveLength(naive.length);
      expect(hashesForPage(html).page.scripts, relativePath).toEqual([...new Set(naive.map(sha256))].sort());
    }
  });
});
