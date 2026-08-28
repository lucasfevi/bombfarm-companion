// Open-or-update exactly one tracker issue, over an injected fetch. Reimplements the
// marker-scoped upsert algorithm (list -> filter by marker -> update-or-create) as a plain node
// module rather than inline workflow JavaScript, precisely so its behaviour under conditions —
// no open marked issue / one open marked issue / only a closed marked issue / the API call fails
// — is a table-driven unit test with no network, not something only a live dispatch can prove.

const GITHUB_API_VERSION = '2022-11-28';

function requestHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  };
}

/** Parses a GitHub `Link` response header into `{ rel: url }`. */
function parseLinkHeader(value) {
  if (!value) return {};
  /** @type {Record<string, string>} */
  const links = {};
  for (const part of value.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) links[match[2]] = match[1];
  }
  return links;
}

function getHeader(response, name) {
  return typeof response.headers?.get === 'function' ? response.headers.get(name) : null;
}

async function listOpenIssues({ fetchImpl, token, repo }) {
  let url = `https://api.github.com/repos/${repo}/issues?state=open&per_page=100`;
  const issues = [];
  while (url) {
    const response = await fetchImpl(url, { headers: requestHeaders(token) });
    if (!response.ok) {
      throw new Error(`list-failed-${response.status}`);
    }
    const page = await response.json();
    issues.push(...page);
    url = parseLinkHeader(getHeader(response, 'link')).next ?? null;
  }
  return issues;
}

/**
 * @param {{ fetchImpl: typeof fetch, token: string, repo: string, marker: string, title: string, body: string }} args
 * @returns {Promise<{ action: 'created'|'updated', number: number, url: string } | { action: 'failed', reason: string }>}
 */
export async function upsertTrackerIssue({ fetchImpl, token, repo, marker, title, body }) {
  let openIssues;
  try {
    openIssues = await listOpenIssues({ fetchImpl, token, repo });
  } catch (err) {
    return { action: 'failed', reason: err instanceof Error ? err.message : 'list-error' };
  }

  // The REST issues-list endpoint returns pull requests too — drop them before the marker
  // filter, or a PR whose body happens to quote the marker gets "updated" as if it were the
  // tracker. A closed marked issue never reaches this list (state=open), so it is naturally
  // never reopened here — a new issue is created instead.
  const markedOpenIssues = openIssues.filter(
    (issue) => issue.pull_request == null && typeof issue.body === 'string' && issue.body.includes(marker),
  );
  const [existing] = markedOpenIssues;

  if (existing) {
    try {
      const response = await fetchImpl(`https://api.github.com/repos/${repo}/issues/${existing.number}`, {
        method: 'PATCH',
        headers: requestHeaders(token),
        body: JSON.stringify({ title, body }),
      });
      if (!response.ok) {
        return { action: 'failed', reason: `patch-failed-${response.status}` };
      }
      return { action: 'updated', number: existing.number, url: existing.html_url };
    } catch (err) {
      return { action: 'failed', reason: err instanceof Error ? err.message : 'patch-error' };
    }
  }

  try {
    const response = await fetchImpl(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: requestHeaders(token),
      body: JSON.stringify({ title, body }),
    });
    if (!response.ok) {
      return { action: 'failed', reason: `post-failed-${response.status}` };
    }
    const created = await response.json();
    return { action: 'created', number: created.number, url: created.html_url };
  } catch (err) {
    return { action: 'failed', reason: err instanceof Error ? err.message : 'post-error' };
  }
}
