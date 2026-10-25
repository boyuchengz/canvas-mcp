# Contributing

Thanks for your interest in improving canvas-mcp. Bug reports, documentation fixes and new read-only tools are all welcome.

## Ground rules

1. **Read-only, always.** Pull requests that add any non-`GET` request to Canvas, or any tool that changes state (submitting, posting, marking as read, editing), will not be merged. This guarantee is the main reason people can trust the project with their token.
2. **No personal data in issues or tests.** Redact names, emails, course IDs and tokens from logs and screenshots. Test fixtures should be invented, not copied from a real Canvas account.
3. **Keep it small.** Prefer the Node.js standard library over new dependencies.

## Getting started

```bash
git clone https://github.com/<you>/canvas-mcp.git
cd canvas-mcp
npm install
cp .env.example .env    # fill in your own Canvas instance and token
npm run dev
```

Requires Node.js 20 or newer (`.nvmrc` pins the version used for development).

## Making a change

1. Create a branch from `main`: `git checkout -b feat/short-description`.
2. Make your change and add or update tests under `test/`.
3. Run `npm run check` (syntax check plus the full test suite). Tests use a fake `fetch` and never touch the network.
4. Update `README.md`, `docs/tools.md` and `CHANGELOG.md` if behaviour or tools changed.
5. Open a pull request and fill in the template.

### Adding a tool

Tools live in `src/tools/`, grouped by area. A new tool should:

- use `canvas.getOne` / `canvas.getList` only;
- pass `annotations: readOnly`;
- wrap its body in `run(...)` so Canvas errors reach the client as `isError` results;
- return only the fields a model needs, with HTML converted through `htmlToText`;
- have a description that says when to use it, written for the model rather than for humans.

The `all 26 tools are registered and marked read-only` test counts tools; update the number when you add one.

## Code style

- ES modules, tabs for indentation (see `.editorconfig`).
- Small, named functions; comments explain *why*, not *what*.
- Commit messages in the imperative mood (`Add get_rubric tool`, `Fix pagination for groups`). [Conventional Commits](https://www.conventionalcommits.org) prefixes are welcome but not required.

## Reporting bugs

Open an issue using the bug report template. Include your Node.js version, hosting platform, the tool name and the error text returned to the client. For security problems, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating you agree to uphold it.
