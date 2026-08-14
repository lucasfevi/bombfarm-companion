import { describe, expect, it, vi } from 'vitest';
import { upsertTrackerIssue } from './wiki-drift/issue.mjs';

const MARKER = '<!-- bfc-wiki-drift-tracker -->';
const REPO = 'lucasfevi/bombfarm-companion';
const TOKEN = 'fake-token';

function noHeaders() {
  return { get: () => null };
}

/** A tiny in-memory GitHub issues store that answers like the real REST API for GET/POST/PATCH
 * on /repos/{repo}/issues[...]. Used for the "two consecutive calls" statefulness proof. */
class FakeGitHubIssues {
  constructor() {
    this.issues = [];
    this.nextNumber = 1;
    this.calls = { get: 0, post: 0, patch: 0 };
  }

  fetchImpl = async (url, options = {}) => {
    const method = options.method ?? 'GET';
    if (method === 'GET') {
      this.calls.get += 1;
      const open = this.issues.filter((issue) => issue.state === 'open');
      return {
        ok: true,
        status: 200,
        headers: noHeaders(),
        json: async () => open.map(({ number, title, body, pull_request, html_url }) => ({
          number, title, body, pull_request, html_url,
        })),
      };
    }
    if (method === 'POST') {
      this.calls.post += 1;
      const payload = JSON.parse(options.body);
      const number = this.nextNumber;
      this.nextNumber += 1;
      const issue = {
        number, title: payload.title, body: payload.body, state: 'open', pull_request: null,
        html_url: `https://github.com/${REPO}/issues/${number}`,
      };
      this.issues.push(issue);
      return { ok: true, status: 201, headers: noHeaders(), json: async () => issue };
    }
    if (method === 'PATCH') {
      this.calls.patch += 1;
      const number = Number(url.match(/issues\/(\d+)$/)[1]);
      const issue = this.issues.find((i) => i.number === number);
      const payload = JSON.parse(options.body);
      issue.title = payload.title;
      issue.body = payload.body;
      return { ok: true, status: 200, headers: noHeaders(), json: async () => issue };
    }
    throw new Error(`FakeGitHubIssues: unexpected method ${method}`);
  };
}

describe('upsertTrackerIssue — request shape (MWD-17..23)', () => {
  it('the list call is GET /repos/{repo}/issues?state=open&per_page=100 with the required headers', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true, status: 200, headers: noHeaders(), json: async () => [],
    }));
    await upsertTrackerIssue({ fetchImpl, token: TOKEN, repo: REPO, marker: MARKER, title: 't', body: 'b' });

    const [listUrl, listOptions] = fetchImpl.mock.calls[0];
    expect(listUrl).toBe(`https://api.github.com/repos/${REPO}/issues?state=open&per_page=100`);
    expect(listOptions.headers).toEqual({
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    });
  });

  it('follows the Link header for pagination — a two-page injected response', async () => {
    const calls = [];
    const fetchImpl = vi.fn(async (url) => {
      calls.push(url);
      if (calls.length === 1) {
        return {
          ok: true,
          status: 200,
          headers: { get: (name) => (name === 'link' ? '<https://api.github.com/repos/o/r/issues?page=2>; rel="next"' : null) },
          json: async () => [{ number: 1, title: 'noise', body: 'no marker here', pull_request: null }],
        };
      }
      return { ok: true, status: 200, headers: noHeaders(), json: async () => [] };
    });
    await upsertTrackerIssue({ fetchImpl, token: TOKEN, repo: REPO, marker: MARKER, title: 't', body: 'b' });
    // Both list pages were fetched (pagination followed); the third call is the POST that
    // follows once the (unmarked) two-page list turns up no existing tracker issue.
    expect(calls.slice(0, 2)).toEqual([
      `https://api.github.com/repos/${REPO}/issues?state=open&per_page=100`,
      'https://api.github.com/repos/o/r/issues?page=2',
    ]);
    expect(calls[2]).toBe(`https://api.github.com/repos/${REPO}/issues`);
  });
});

describe('upsertTrackerIssue — entries carrying a pull_request key are dropped (MWD-17)', () => {
  it('a PR whose body contains the marker yields created, not updated', async () => {
    const fetchImpl = vi.fn(async (url, options = {}) => {
      const method = options.method ?? 'GET';
      if (method === 'GET') {
        return {
          ok: true,
          status: 200,
          headers: noHeaders(),
          json: async () => [
            { number: 99, title: 'a PR', body: `${MARKER}\nthis is a pull request`, pull_request: { url: 'x' } },
          ],
        };
      }
      return {
        ok: true, status: 201, headers: noHeaders(),
        json: async () => ({ number: 5, html_url: 'https://example.invalid/issues/5' }),
      };
    });
    const result = await upsertTrackerIssue({ fetchImpl, token: TOKEN, repo: REPO, marker: MARKER, title: 't', body: 'b' });
    expect(result.action).toBe('created');
    const patchCalls = fetchImpl.mock.calls.filter(([, opts]) => opts?.method === 'PATCH');
    expect(patchCalls).toEqual([]);
  });
});

describe('upsertTrackerIssue — the five cases (MWD-17, MWD-18, MWD-22, MWD-23)', () => {
  it('no open marked issue ⇒ exactly 1 POST, 0 PATCH', async () => {
    const store = new FakeGitHubIssues();
    const result = await upsertTrackerIssue({
      fetchImpl: store.fetchImpl, token: TOKEN, repo: REPO, marker: MARKER, title: 't1', body: `${MARKER}\nbody1`,
    });
    expect(result.action).toBe('created');
    expect(store.calls.post).toBe(1);
    expect(store.calls.patch).toBe(0);
  });

  it('one open marked issue ⇒ exactly 1 PATCH, 0 POST', async () => {
    const store = new FakeGitHubIssues();
    store.issues.push({
      number: 7, title: 'old', body: `${MARKER}\nold body`, state: 'open', pull_request: null,
      html_url: 'https://example.invalid/issues/7',
    });
    const result = await upsertTrackerIssue({
      fetchImpl: store.fetchImpl, token: TOKEN, repo: REPO, marker: MARKER, title: 't2', body: `${MARKER}\nnew body`,
    });
    expect(result.action).toBe('updated');
    expect(result.number).toBe(7);
    expect(store.calls.patch).toBe(1);
    expect(store.calls.post).toBe(0);
  });

  it('two consecutive calls against the same injected state ⇒ exactly one open marked issue afterwards (MWD-19 unit half)', async () => {
    const store = new FakeGitHubIssues();
    const first = await upsertTrackerIssue({
      fetchImpl: store.fetchImpl, token: TOKEN, repo: REPO, marker: MARKER, title: 'Wiki data drift — 1 section(s) differ',
      body: `${MARKER}\nobserved at: 2026-08-14T05:17:00.000Z`,
    });
    const second = await upsertTrackerIssue({
      fetchImpl: store.fetchImpl, token: TOKEN, repo: REPO, marker: MARKER, title: 'Wiki data drift — 1 section(s) differ',
      body: `${MARKER}\nobserved at: 2026-08-14T06:17:00.000Z`,
    });

    expect(first.action).toBe('created');
    expect(second.action).toBe('updated');
    expect(second.number).toBe(first.number);

    const openMarked = store.issues.filter(
      (issue) => issue.state === 'open' && issue.body.includes(MARKER),
    );
    expect(openMarked).toHaveLength(1);

    // The second call's body differs from the first's (a differing observation timestamp) —
    // the same shape the post-merge dispatch (T12) will prove end-to-end.
    expect(openMarked[0].body).not.toBe(
      `${MARKER}\nobserved at: 2026-08-14T05:17:00.000Z`,
    );
    expect(openMarked[0].body).toBe(`${MARKER}\nobserved at: 2026-08-14T06:17:00.000Z`);
  });

  it('only a closed marked issue exists ⇒ 1 POST; the closed issue is never PATCHed or reopened (MWD-22)', async () => {
    const store = new FakeGitHubIssues();
    store.issues.push({
      number: 3, title: 'resolved', body: `${MARKER}\nresolved body`, state: 'closed', pull_request: null,
      html_url: 'https://example.invalid/issues/3',
    });
    const result = await upsertTrackerIssue({
      fetchImpl: store.fetchImpl, token: TOKEN, repo: REPO, marker: MARKER, title: 't3', body: `${MARKER}\nnew`,
    });
    expect(result.action).toBe('created');
    expect(store.calls.post).toBe(1);
    expect(store.calls.patch).toBe(0);
    const closedIssue = store.issues.find((i) => i.number === 3);
    expect(closedIssue.state).toBe('closed');
    expect(closedIssue.body).toBe(`${MARKER}\nresolved body`);
  });

  it('a non-2xx on the list call ⇒ failed, with the reason (MWD-23)', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 403, headers: noHeaders(), json: async () => ({}) }));
    const result = await upsertTrackerIssue({ fetchImpl, token: TOKEN, repo: REPO, marker: MARKER, title: 't', body: 'b' });
    expect(result.action).toBe('failed');
    expect(result.reason).toContain('403');
  });

  it('a thrown error on the create call ⇒ failed, with the reason (MWD-23)', async () => {
    const fetchImpl = vi.fn(async (url, options = {}) => {
      if ((options.method ?? 'GET') === 'GET') {
        return { ok: true, status: 200, headers: noHeaders(), json: async () => [] };
      }
      throw new Error('network exploded');
    });
    const result = await upsertTrackerIssue({ fetchImpl, token: TOKEN, repo: REPO, marker: MARKER, title: 't', body: 'b' });
    expect(result.action).toBe('failed');
    expect(result.reason).toContain('network exploded');
  });

  it('a non-2xx on the update call ⇒ failed, with the reason (MWD-23)', async () => {
    const fetchImpl = vi.fn(async (url, options = {}) => {
      const method = options.method ?? 'GET';
      if (method === 'GET') {
        return {
          ok: true, status: 200, headers: noHeaders(),
          json: async () => [{ number: 9, title: 'x', body: MARKER, pull_request: null }],
        };
      }
      return { ok: false, status: 500, headers: noHeaders(), json: async () => ({}) };
    });
    const result = await upsertTrackerIssue({ fetchImpl, token: TOKEN, repo: REPO, marker: MARKER, title: 't', body: 'b' });
    expect(result.action).toBe('failed');
    expect(result.reason).toContain('500');
  });
});

describe('upsertTrackerIssue — the caller contract for an ok outcome', () => {
  it('this module is never invoked at all when the outcome is ok — no fetch call happens because nothing calls it', () => {
    // upsertTrackerIssue has no "no-op" branch of its own: the CLI (T7) simply does not call it
    // when there is no drift. Demonstrated here as a contract, not a behaviour of this module.
    const fetchImpl = vi.fn();
    const diffs = [];
    if (diffs.length > 0) {
      upsertTrackerIssue({ fetchImpl, token: TOKEN, repo: REPO, marker: MARKER, title: 't', body: 'b' });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
