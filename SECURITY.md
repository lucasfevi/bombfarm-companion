# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 0.x (pre-release) | ✅ |

## Reporting a vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

Email the maintainers with:

- A description of the issue and potential impact
- Steps to reproduce
- Affected version or commit

We will acknowledge receipt within a reasonable timeframe and work on a fix before public disclosure when appropriate.

## Scope

This app reads local game process memory (read-only) and fetches public game wiki data. It must never transmit Steam credentials, game auth tokens, or raw inventory dumps without explicit user action.
