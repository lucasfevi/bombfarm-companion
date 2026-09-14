import { describe, expect, it } from 'vitest';
import { boxedElectronPids, parseListPids, parseTasklistPids } from './dev-sandbox.mjs';

describe('parseListPids', () => {
  it('drops the leading count and keeps one pid per line, CRLF included', () => {
    expect(parseListPids('3\r\n66912\r\n34960\r\n34924\r\n')).toEqual([66912, 34960, 34924]);
  });

  it('reads an empty box as no pids, not as the count', () => {
    expect(parseListPids('0\r\n')).toEqual([]);
    expect(parseListPids('')).toEqual([]);
  });
});

describe('parseTasklistPids', () => {
  it('takes the pid from the second CSV column of every row', () => {
    const output = [
      '"electron.exe","52780","Console","1","123,456 K"',
      '"electron.exe","57152","Console","1","98,765 K"',
      '',
    ].join('\r\n');
    expect(parseTasklistPids(output)).toEqual([52780, 57152]);
  });

  it('reads the no-match INFO sentence as no pids', () => {
    expect(parseTasklistPids('INFO: No tasks are running which match the specified criteria.\r\n')).toEqual([]);
  });
});

describe('boxedElectronPids', () => {
  it('keeps only the Electron processes that are inside the box', () => {
    const inBox = [66912, 35424, 52780, 57152];
    const runningImage = [12345, 52780, 57152];
    expect(boxedElectronPids({ inBox, runningImage })).toEqual([52780, 57152]);
  });

  it('never returns the game or Steam, which share the box but not the image', () => {
    expect(boxedElectronPids({ inBox: [66912, 35424], runningImage: [] })).toEqual([]);
  });
});
