# Security Policy

canvas-mcp handles a Canvas access token that can read a student's grades, messages and coursework, so security reports are taken seriously.

## Supported versions

Only the latest release on `main` receives fixes.

| Version | Supported |
| --- | --- |
| 1.2.x | ✅ |
| < 1.2 | ❌ |

## Reporting a vulnerability

**Please do not open a public issue.** Use GitHub's private reporting instead:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.

Include what you found, how to reproduce it, and the impact you expect. You can expect an acknowledgement within 72 hours and a status update within 7 days. Once a fix is released you will be credited in the changelog unless you prefer otherwise.

## Scope

In scope:

- Any way to make the server write to Canvas or change state.
- Bypassing the `MCP_SECRET` check or discovering the secret.
- The Canvas token being sent anywhere other than `CANVAS_BASE_URL`.
- Injection or path traversal through tool arguments.

Out of scope:

- A leaked connector URL or Canvas token caused by the operator sharing it.
- Denial of service against your own deployment.
- Data that Canvas itself exposes to the token owner.

## Hardening checklist for operators

- Serve the endpoint over HTTPS only.
- Use a secret of at least 48 random hex characters.
- Give the Canvas token an expiry date and rotate it periodically.
- Don't paste the connector URL into shared documents, screenshots or chat logs.
