import { describe, expect, it } from 'vitest';
import { checkBundlePath } from './bundle-paths.js';

describe('checkBundlePath', () => {
  it.each(['worker/index.cjs', 'ui/index.js', 'ui/index.css', 'a/b-c_d.e/f'])('accepts %s', (p) => {
    expect(checkBundlePath(p)).toBe('ok');
  });

  it.each([
    ['empty', ''],
    ['absolute posix', '/etc/passwd'],
    ['leading slash', '/worker/index.cjs'],
    ['backslash', 'worker\\index.cjs'],
    ['drive letter', 'C:/worker/index.cjs'],
    ['drive letter alone', 'c:index.cjs'],
    ['NUL', 'worker/index\u0000.cjs'],
    ['control character', 'worker/in\u001fdex.cjs'],
    ['delete character', 'worker/in\u007fdex.cjs'],
    ['parent segment', '../index.cjs'],
    ['embedded parent segment', 'ui/../worker/index.cjs'],
    ['trailing parent segment', 'ui/..'],
    ['dot segment', './index.cjs'],
    ['lone dot', '.'],
    ['percent sign', 'ui/%2e%2e/index.js'],
    ['space', 'ui/in dex.js'],
    ['non-ASCII letter', 'ui/índex.js'],
    ['colon after the first segment', 'ui/a:b.js'],
    ['query character', 'ui/index.js?x'],
    ['double slash', 'a//b'],
    ['inner dot segment', 'a/./b'],
    ['trailing slash', 'ui/'],
  ])('refuses %s', (_name, p) => {
    expect(checkBundlePath(p)).toBe('bad_path');
  });
});
