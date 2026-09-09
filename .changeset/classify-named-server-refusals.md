---
"@bombfarm/game-api": patch
"@bombfarm/desktop": patch
---

Treat a refusal the server names in the body as a failure, at any HTTP status. The server reports
maintenance, bans, terms and dead sessions as `{"error":"CODE"}`, and does so on otherwise-normal
responses — the game client screens every response for it before its own handlers run. We only
looked at status codes, so a 200 carrying `{"error":"SERVER_LOCKED"}` parsed as a perfectly good
JSON object and was committed as account state on three of the five sections.

Such a response is now `api_error`, carrying the code, and the four codes that mean the session is
over (`NO_TOKEN`, `BAD_TOKEN`, `WRONG_ACCOUNT`, `SESSION_EXPIRED`) are treated as `unauthorized`
so the pacing gate halts instead of retrying with a dead token. The code is logged with the failed
section, so a maintenance window is diagnosable rather than a generic error.
