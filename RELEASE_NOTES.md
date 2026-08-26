# OpenCompress Studio 2.1.0

OpenCompress Studio 2.1.0 turns the project into a more complete local-first batch image workflow for shops, creators and automation.

## Highlights

- Private-by-default local compression with Sharp.
- Batch workflow for up to 250 images in the GUI.
- Auto Best local mode for comparing multiple local output candidates.
- Target file-size mode for JPG/WebP output.
- Before/after preview, candidate comparison and detailed savings.
- Shop-focused presets, SEO batch rename and ZIP export.
- New local-only CLI preview for scripts, CI jobs and large folders.

## Added

- Auto Best local mode that tests multiple local output candidates and keeps the smallest result.
- Fair Compare mode for local-vs-reSmush.it comparisons.
- Target file size mode for JPG/WebP output.
- SEO batch rename with custom base name, start number and padding.
- Transparency warning and custom JPG flatten background color.
- Keep-original-if-larger safety option.
- Cancel Batch button in the UI.
- Before/after preview zoom.
- Candidate comparison panel for Auto Best and Auto Compare results.
- Expanded results table with format, dimensions, quality, method, status and warnings.
- More specific shop/image presets.
- Local CLI preview with file/folder input, recursive scanning, WebP/JPG/PNG output, quality, resize, JSON summaries and keep-original-if-larger behavior.
- GitHub contribution, security, issue and pull-request templates.
- Dependabot configuration and stronger CI checks.

## Fixed and hardened

- Fresh Windows clones now build before starting production mode.
- Invalid job IDs can no longer collapse to the jobs root during deletion.
- Target-size compression now works when preferred quality is below 35.
- Duplicate filenames map to the correct active preview item.
- Upload count and malformed settings errors return clearer API responses.
- Result downloads use streaming file responses instead of unnecessary whole-file buffering.
- reSmush.it requests now have bounded timeouts and HTTPS result validation.
- Numeric environment settings are validated and bounded.
- CLI image processing is smoke-tested in GitHub Actions with a generated image fixture.

## Changed

- Local compression reports original and output dimensions/formats.
- Auto Compare can run in a fair mode with no resize, original format and matching quality.
- ZIP report includes settings and detailed result metadata.
- README now explains privacy modes, CLI usage and workflow positioning versus Squoosh and TinyPNG/TinyJPG without synthetic benchmark claims.
- Supported Node.js versions are aligned across documentation, launcher and CI.

## CLI preview

```bash
npm ci
npm run cli -- ./images --format webp --quality 82 --max-width 1600 -o ./optimized
```

Run `npm run cli -- --help` for all options. The CLI is local-only in 2.1.0; Auto Best, target-size search and reSmush.it remain GUI-only.

## Privacy notes

- Local only, Auto Best local and CLI modes do not upload images externally.
- reSmush.it remains optional and is used only when explicitly selected in the GUI.
- Temporary GUI jobs live under `.opencompress/` and expire automatically.

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10+

## Install

```bash
git clone https://github.com/SLP-DEV1/OpenCompress.git
cd OpenCompress
npm ci
npm run dev
```

Windows users can also run `start.bat` after installing a supported Node.js version.
