# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `Dockerfile` and `.dockerignore` for container hosts; the ignore file keeps `.env`, `.dev.vars` and `node_modules` out of the build context.
- Gagarin Cloud deployment guide under "Other hosting options".

### Changed

- Railway now builds from the `Dockerfile`, since it always prefers a root `Dockerfile` over its default builder. `railway.json` sets `builder` to `DOCKERFILE` so this is explicit. Existing Railway deployments rebuild on Node.js 22 Alpine on their next deploy; no variables change. New `fly launch` runs also pick up the `Dockerfile`.

## [1.2.0] - 2026-10-25

First public release.

### Added

- 26 read-only tools covering courses, modules, pages, syllabus, staff, groups, planner, to-do, missing work, assignments, quizzes, calendar, grades, grade breakdown, files, announcements, discussions, inbox and activity stream.
- Streamable HTTP transport in stateless mode, protected by a secret URL path.
- `/healthz` endpoint for hosting platforms.
- Startup validation of all environment variables.
- Graceful shutdown on `SIGTERM` / `SIGINT`.
- Test suite built on `node:test`, with CI on Node.js 20, 22 and 24.
- Railway configuration and deployment guides for Railway, Render, Fly.io and self-hosting.

### Security

- Pagination links are only followed on the configured Canvas host, so the token can't be forwarded elsewhere.
- File downloads use Canvas's pre-signed URLs without the API token.
- Secret comparison is constant-time and does not leak length.

[Unreleased]: https://github.com/boyuchengz/canvas-mcp/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/boyuchengz/canvas-mcp/releases/tag/v1.2.0
