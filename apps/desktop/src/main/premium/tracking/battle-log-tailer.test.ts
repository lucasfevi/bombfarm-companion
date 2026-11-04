import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BATTLE_LOG_POLL_MS,
  createBattleLogTailer,
  extractSection,
  isCompleteSection,
  type BattleLogPayload,
  type BattleLogSource,
  type BattleLogTailerDeps,
} from './battle-log-tailer.js';

const LOG = 'dir/battle_log.cfg';

const entries = (n: number): string => `entries=${JSON.stringify(Array.from({ length: n }, (_, i) => ({ k: `e${String(i)}` })))}`;
const file = (...sections: Array<[string, string]>): string =>
  sections.map(([id, body]) => `[acc_${id}]\n${body}\n\n`).join('');

function memoryFs() {
  let current: { text: string; mtimeMs: number } | null = null;
  let clock = 1_000;
  let onRead: (() => void) | undefined;
  const state = { language: null as string | null, failReads: false, reads: 0 };
  const source: BattleLogSource = {
    stat: () => (current ? { mtimeMs: current.mtimeMs, size: current.text.length } : null),
    read: () => {
      if (state.failReads) throw new Error('EBUSY');
      state.reads += 1;
      if (!current) return null;
      const text = current.text;
      onRead?.();
      return text;
    },
    gameLanguage: () => state.language,
  };
  return {
    source,
    state,
    write(_path: string, text: string) {
      clock += 10;
      current = { text, mtimeMs: clock };
    },
    duringNextRead(fn: () => void) {
      onRead = () => {
        onRead = undefined;
        fn();
      };
    },
  };
}

function setup(over: Partial<BattleLogTailerDeps> = {}) {
  const fs = memoryFs();
  const sent: BattleLogPayload[] = [];
  const deps: BattleLogTailerDeps = {
    source: fs.source,
    licensedAccountId: () => '486',
    now: () => 5_000,
    send: (payload) => {
      sent.push(payload);
      return true;
    },
    ...over,
  };
  return { fs, sent, tailer: createBattleLogTailer(deps) };
}

const tick = (ms = BATTLE_LOG_POLL_MS): void => {
  vi.advanceTimersByTime(ms);
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('extractSection / isCompleteSection', () => {
  it('takes the body between the header and the next header, trimming trailing blanks', () => {
    const text = file(['7', entries(1)], ['486', entries(2)], ['9', entries(3)]);
    expect(extractSection(text, '486')).toBe(entries(2));
  });

  it('matches the header trimmed and anchored: [acc_48] is not [acc_486]', () => {
    expect(extractSection(`[acc_4860]\n${entries(1)}\n`, '486')).toBeNull();
    expect(extractSection(`  [acc_486]  \r\n${entries(1)}\r\n`, '486')).toBe(entries(1));
  });

  it('completeness: a JSON array after entries=, nothing else', () => {
    expect(isCompleteSection(entries(0))).toBe(true);
    expect(isCompleteSection('entries=[{"k":')).toBe(false);
    expect(isCompleteSection('entries={"k":1}')).toBe(false);
    expect(isCompleteSection('other=[]')).toBe(false);
  });
});

describe('the tailer', () => {
  it('sends only the licensed section, header removed, first with baseline; an unchanged rewrite sends nothing', () => {
    const { fs, sent, tailer } = setup();
    fs.write(LOG, file(['7', entries(1)], ['486', entries(2)]));
    fs.state.language = 'pt';
    tailer.start();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({
      atMs: 5_000,
      accountKey: '486',
      section: 'acc_486',
      text: entries(2),
      mtimeMs: 1_010,
      gameLanguage: 'pt',
      baseline: true,
    });
    expect(JSON.stringify(sent)).not.toContain('acc_7');
    expect(JSON.stringify(sent)).not.toContain('[acc_');

    // same section rewritten (file touched, other account's section changed): nothing
    fs.write(LOG, file(['7', entries(5)], ['486', entries(2)]));
    tick();
    expect(sent).toHaveLength(1);

    // a real change of the section: sent, no longer a baseline
    fs.write(LOG, file(['7', entries(5)], ['486', entries(3)]));
    tick();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ text: entries(3), baseline: false });
    tailer.stop();
  });

  it('a half-written entries= sends nothing, and the next good read sends', () => {
    const { fs, sent, tailer } = setup();
    fs.write(LOG, '[acc_486]\nentries=[{"k":"e0"},{"k"');
    tailer.start();
    tick(10_000);
    expect(sent).toHaveLength(0);

    fs.write(LOG, file(['486', entries(2)]));
    tick();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ text: entries(2), baseline: true });
    tailer.stop();
  });

  it('a missing file, a missing section and no licensed account send nothing and the watcher lives on', () => {
    let account: string | null = '486';
    const { fs, sent, tailer } = setup({ licensedAccountId: () => account });
    tailer.start(); // no file
    tick();
    expect(sent).toHaveLength(0);

    fs.write(LOG, file(['7', entries(1)])); // no such section
    tick();
    expect(sent).toHaveLength(0);

    account = null;
    fs.write(LOG, file(['486', entries(1)]));
    tick();
    expect(sent).toHaveLength(0);

    account = '486';
    tick();
    expect(sent).toHaveLength(1);
    tailer.stop();
  });

  it('gameLanguage is null when the game has no language set', () => {
    const { fs, sent, tailer } = setup();
    fs.write(LOG, file(['486', entries(1)]));
    tailer.start();
    expect(sent[0]?.gameLanguage).toBeNull();
    fs.state.language = null;
    fs.write(LOG, file(['486', entries(2)]));
    tick();
    expect(sent[1]?.gameLanguage).toBeNull();
    tailer.stop();
  });

  it('a file that changes during the read is re-read, not sent torn', () => {
    const { fs, sent, tailer } = setup();
    fs.write(LOG, file(['486', entries(1)]));
    fs.duringNextRead(() => {
      fs.write(LOG, file(['486', entries(2)]));
    });
    tailer.start();
    expect(sent).toHaveLength(0);
    tick(250);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toBe(entries(2));
    tailer.stop();
  });

  it('a file that keeps changing is given up for this poll after three tries, then read again', () => {
    const { fs, sent, tailer } = setup();
    let n = 1;
    const churn = (): void => {
      n += 1;
      fs.write(LOG, file(['486', entries(n)]));
    };
    fs.write(LOG, file(['486', entries(1)]));
    fs.duringNextRead(churn);
    tailer.start();
    fs.duringNextRead(churn);
    tick(250);
    fs.duringNextRead(churn);
    tick(250);
    expect(sent).toHaveLength(0);
    tick(BATTLE_LOG_POLL_MS);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toBe(entries(n));
    tailer.stop();
  });

  it('stop ends the polling; start again re-baselines even when nothing changed', () => {
    const { fs, sent, tailer } = setup();
    fs.write(LOG, file(['486', entries(1)]));
    tailer.start();
    tailer.stop();
    fs.write(LOG, file(['486', entries(2)]));
    tick(10_000);
    expect(sent).toHaveLength(1);

    tailer.start();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ text: entries(2), baseline: true });
    tailer.stop();
  });

  it('a refused send is offered again, still unsent, on the next poke', () => {
    let accept = false;
    const sent: BattleLogPayload[] = [];
    const { fs, tailer } = setup({
      send: (p) => {
        if (accept) sent.push(p);
        return accept;
      },
    });
    fs.write(LOG, file(['486', entries(1)]));
    tailer.start();
    expect(sent).toHaveLength(0);
    accept = true;
    tailer.poke();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.baseline).toBe(true);
    tailer.poke();
    expect(sent).toHaveLength(1);
    tailer.stop();
  });

  it('a change of the licensed account sends the new account first with baseline', () => {
    let account = '486';
    const { fs, sent, tailer } = setup({ licensedAccountId: () => account });
    fs.write(LOG, file(['486', entries(1)], ['7', entries(1)]));
    tailer.start();
    account = '7';
    tick();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ accountKey: '7', section: 'acc_7', baseline: true });
    tailer.stop();
  });

  it('a throwing fs does not stop the watcher', () => {
    const { fs, sent, tailer } = setup();
    fs.write(LOG, file(['486', entries(1)]));
    fs.state.failReads = true;
    tailer.start();
    expect(sent).toHaveLength(0);
    fs.state.failReads = false;
    tick();
    expect(sent).toHaveLength(1);
    tailer.stop();
  });

  it('the folder watch wakes a check early and is released on stop', () => {
    let wake: (() => void) | undefined;
    const release = vi.fn();
    const { fs, sent, tailer } = setup({
      watch: (w) => {
        wake = w;
        return release;
      },
    });
    tailer.start();
    fs.write(LOG, file(['486', entries(1)]));
    wake?.();
    expect(sent).toHaveLength(1);
    tailer.stop();
    expect(release).toHaveBeenCalledOnce();
  });

  it('no payload field carries the path or another section', () => {
    const { fs, sent, tailer } = setup();
    fs.write(LOG, file(['7', 'entries=[{"secret":"other"}]'], ['486', entries(1)]));
    tailer.start();
    const serialized = JSON.stringify(sent);
    expect(serialized).not.toContain(LOG);
    expect(serialized).not.toContain('battle_log');
    expect(serialized).not.toContain('secret');
    tailer.stop();
  });
});
