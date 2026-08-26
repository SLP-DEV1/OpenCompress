# Contributing to OpenCompress Studio

Thanks for helping improve OpenCompress.

## Before you start

- Search existing issues and pull requests before opening a duplicate.
- Keep Local only and Auto Best local modes private by default.
- Do not add analytics, telemetry or automatic external uploads without an explicit opt-in design and discussion.
- Prefer focused pull requests over large unrelated refactors.

## Development setup

Requirements:

- Node.js 20.19+ or 22.12+
- npm 10+

```bash
git clone https://github.com/SLP-DEV1/OpenCompress.git
cd OpenCompress
npm ci
npm run dev
```

Open `http://127.0.0.1:5174`.

## Quality checks

Run these before opening a pull request:

```bash
npm run typecheck:strict
npm run build
```

If your change affects image processing, manually test at least:

- JPG input
- PNG with transparency
- WebP input
- Keep-original-if-larger behavior
- A multi-file batch
- ZIP download

If your change touches reSmush.it behavior, also confirm that Local only and Auto Best local never call the external API.

## Pull requests

A good pull request includes:

- A clear explanation of the problem and solution
- Screenshots for visible UI changes
- Reproduction steps for bug fixes
- Notes about privacy or network behavior when relevant
- Updated documentation when user-facing behavior changes

Keep generated folders and test outputs out of commits. In particular, do not commit `node_modules/`, `dist/`, `.opencompress/`, ZIP exports or private images.

## Commit style

Short conventional-style subjects are preferred, for example:

```text
fix: prevent invalid job deletion
feat: add AVIF output
perf: stream ZIP downloads
docs: clarify local privacy mode
```

## Reporting bugs

Use the bug report template and include your OS, Node.js version, browser, input format and exact reproduction steps. Never attach confidential source images to a public issue.
