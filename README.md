<div align="center">

# OpenCompress Studio

**Private-by-default batch image compression for shops, creators and the web.**

Compress, resize, convert and SEO-rename hundreds of images locally with Sharp, compare results visually and export the complete batch as a ZIP.

[![CI](https://github.com/SLP-DEV1/OpenCompress/actions/workflows/ci.yml/badge.svg)](https://github.com/SLP-DEV1/OpenCompress/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20.19%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![GitHub stars](https://img.shields.io/github/stars/SLP-DEV1/OpenCompress?style=social)](https://github.com/SLP-DEV1/OpenCompress/stargazers)

**No account. No SaaS subscription. No image upload in Local or Auto Best mode.**

</div>

![OpenCompress Studio preview](docs/screenshot.svg)

## Why OpenCompress?

Most image compressors are either single-file tools, cloud services or too generic for real shop workflows. OpenCompress Studio is built around repeatable batches:

- **Local-first:** JPG, PNG and WebP processing uses `sharp` on your own computer.
- **Shop-ready presets:** WooCommerce, Amazon, Etsy, Instagram, transparent PNG and small-web presets are included.
- **Batch workflow:** resize, convert, target a file size, rename for SEO and download everything in one ZIP.
- **Visual control:** before/after slider, candidate comparison and detailed per-file savings.
- **Safe defaults:** metadata removal and keep-original-if-larger are enabled by design.
- **Optional external comparison:** reSmush.it can be enabled explicitly and automatically falls back to local compression when possible.

## Where it fits

This is a workflow comparison, not a claim that one encoder always produces smaller files. Results depend on image content, codec and settings.

| Tool | Processing model | Strong fit | OpenCompress difference |
| --- | --- | --- | --- |
| **OpenCompress Studio** | Local Node.js + Sharp by default; optional reSmush.it | Repeatable shop and creator batches | Presets, SEO rename, target-size mode, before/after review and ZIP batch export in one workflow |
| **[Squoosh](https://squoosh.app/)** | Local in the browser | Hands-on visual codec tuning | OpenCompress focuses on repeatable multi-image shop workflows and can also be automated from the CLI |
| **[TinyPNG / TinyJPG](https://tinypng.com/)** | Hosted service/API; images are sent to the service for compression | Managed web/API compression | OpenCompress can keep the complete image workflow local with no account or API key |

Squoosh documents that image processing stays on-device. TinyPNG's API documentation describes uploading image data to its service for compression. OpenCompress is aimed at users who want the local model plus batch-oriented e-commerce tooling.

## Quick start

### Windows

1. Download or clone the repository.
2. Double-click `start.bat`.
3. Open `http://127.0.0.1:5174` if the browser does not open automatically.

The helper checks Node.js, installs dependencies on first run, builds the app and starts the local server.

### macOS / Linux / developers

```bash
git clone https://github.com/SLP-DEV1/OpenCompress.git
cd OpenCompress
npm ci
npm run dev
```

Open `http://127.0.0.1:5174`.

## CLI

The local-only CLI is built for scripts, CI jobs and large folders. It does not call reSmush.it or another external image service.

```bash
# Convert a folder to WebP at quality 82
npm run cli -- ./images --format webp --quality 82

# Resize a complete catalog recursively
npm run cli -- ./catalog --recursive --format webp --quality 82 --max-width 1600 --max-height 1600 -o ./optimized

# Auto Best: test local candidates and keep the smallest
npm run cli -- ./catalog --recursive --auto-best -o ./optimized

# Target size: search for the highest WebP quality at or below 300 KB
npm run cli -- hero.jpg --format webp --quality 92 --target-size-kb 300

# Combine Auto Best + target size for a batch
npm run cli -- ./products --auto-best --target-size 250 --max-width 1600 --json

# JPEG output with a white background for transparent inputs
npm run cli -- hero.png --format jpg --quality 90 --background '#ffffff'
```

CLI options:

```text
-o, --output <dir>       Output directory
-f, --format <format>    webp, jpg/jpeg or png
-q, --quality <1-100>    Preferred lossy quality
    --auto-best          Test local candidates and keep the smallest
    --target-size <KB>   Alias for --target-size-kb
    --target-size-kb <KB> Search highest JPG/WebP quality under target
    --max-width <px>     Maximum output width
    --max-height <px>    Maximum output height
-r, --recursive          Scan nested directories
    --allow-larger       Keep optimized output even when larger
    --background <hex>   JPG alpha background
    --json               Machine-readable JSON summary
```

Auto Best mirrors the local GUI strategy: images without alpha test WebP + JPEG, while images with alpha test WebP + PNG. A different explicit `--format` is added as another candidate. Target-size mode uses up to seven quality-search steps for JPG/WebP and reports the selected quality plus `targetReached` in JSON.

Run `npm run cli -- --help` for the complete usage text. The CLI supports JPG, PNG, WebP, TIFF and BMP inputs. reSmush.it and Auto Compare remain GUI-only.

## Feature highlights

- Batch upload for up to 250 images
- JPG, PNG, WebP, GIF, TIF and BMP input in the GUI
- JPG, PNG and WebP output
- Local compression with `sharp`
- Local-only CLI for scripts and folder processing
- CLI Auto Best candidate selection
- CLI target-size search for JPG/WebP
- Auto Best local mode that tests multiple output candidates and keeps the smallest
- Optional reSmush.it API compression
- Auto Compare local vs reSmush.it
- Fair Compare mode with matching format, quality and dimensions
- Target file-size search for JPG/WebP
- Resize with maximum width and height while preventing enlargement
- Metadata removal by default
- Optional EXIF preservation for reSmush.it mode
- Transparency warnings and configurable JPG background color
- SEO batch rename with start number and padding
- Keep-original-if-larger protection
- Before/after preview with zoom
- Per-candidate comparison
- Detailed result table with dimensions, formats, quality, method, status and savings
- ZIP export with `opencompress-report.json`
- Automatic cleanup of temporary jobs

## Privacy modes

| Mode | Works offline | Sends images externally | Best for |
| --- | --- | --- | --- |
| **Local only** | Yes | No | Default private workflow |
| **Auto Best local** | Yes | No | Smallest local result without cloud uploads |
| **reSmush.it API** | No | Yes | Explicit external compression |
| **Auto Compare** | No | Yes | Comparing local output with reSmush.it |
| **CLI** | Yes | No | Scripts, CI jobs and local folders |

Local-only processing stores temporary GUI job files in `.opencompress/` and removes old jobs automatically after the configured TTL. CLI output is written directly to the selected output directory.

> If you bind `OPENCOMPRESS_HOST` to a non-loopback address, the local API becomes reachable from your network. Keep the default `127.0.0.1` unless you intentionally want remote access.

## Recommended shop presets

### WooCommerce product images

```text
Mode: Local only or Auto Best local
Format: WebP
Quality: 82
Max size: 1600 × 1600 px
Metadata: remove
```

### Amazon main images

```text
Mode: Local only
Format: JPG
Quality: 90
Max size: 2000 × 2000 px
Background: white
Metadata: remove
```

### Etsy listing images

```text
Mode: Local only
Format: JPG
Quality: 86
Max size: 2000 × 2000 px
Metadata: remove
```

### Transparent artwork

```text
Mode: Local only or Auto Best local
Format: PNG or WebP
Avoid JPG unless you intentionally want to flatten transparency
```

## Target file size

Enable **Target file size** in the GUI or pass `--target-size-kb <KB>` in the CLI. For JPG and WebP, OpenCompress searches for the highest quality that gets under the requested target when possible.

If the target cannot be reached, the result is still returned and `targetReached` is reported as `false` instead of silently failing.

## reSmush.it support

reSmush.it is optional and is never used by Local only, Auto Best local or CLI mode.

Supported external inputs:

```text
JPG, PNG, GIF, TIF, BMP
```

WebP remains available through local processing. Files unsupported by reSmush.it fall back to local compression when the selected workflow permits it.

## Requirements

- Node.js **20.19+** or **22.12+**
- npm 10+
- A modern Chromium, Firefox or Safari browser
- Internet access only for dependency installation and optional reSmush.it modes

## Production build

```bash
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:5174`.

## Useful scripts

```bash
npm run dev              # Local development server with Vite middleware
npm start                # Production server using dist/
npm run cli -- --help    # Local CLI usage
npm run build            # Type-check and build production assets
npm run typecheck        # TypeScript checks
npm run typecheck:strict # TypeScript checks including unused-code detection
npm run clean            # Remove dist, node_modules and .opencompress
```

## Configuration

Copy `.env.example` or set environment variables before starting the app:

```bash
OPENCOMPRESS_PORT=5174
OPENCOMPRESS_HOST=127.0.0.1
OPENCOMPRESS_MAX_UPLOAD_MB=100
OPENCOMPRESS_JOB_TTL_MS=3600000
OPENCOMPRESS_EXTERNAL_TIMEOUT_MS=30000
OPENCOMPRESS_PUBLIC_REFERER=https://github.com/SLP-DEV1/OpenCompress
OPENCOMPRESS_USER_AGENT=OpenCompress-Studio/2.1.0
```

## Project structure

```text
OpenCompress/
├─ bin/                  Local CLI
├─ src/                  React UI
├─ server/               Local Express + Sharp processing API
├─ docs/                 Repository media and documentation
├─ .github/workflows/    CI automation
├─ start.bat             Windows one-click build + start
├─ stop.bat              Windows local-server stop helper
└─ README.md
```

## Roadmap

Good next contributions include:

- Shared compression core for GUI + CLI to prevent behavior drift
- CLI parity for SEO rename and presets
- Real per-file streaming progress
- Drag-and-drop file sorting
- AVIF export
- SSIM / visual quality scoring
- Saved custom presets
- Multi-language UI
- Optional local AI upscaling backends

Have an idea that would make OpenCompress more useful? Open a feature request instead of keeping it in a fork.

## Contributing

Contributions are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md), run the strict typecheck and build before opening a pull request, and keep privacy-sensitive behavior explicit.

For security issues, please read [`SECURITY.md`](SECURITY.md) before opening a public issue.

## License

MIT. See [`LICENSE`](LICENSE).

---

If OpenCompress saves you time, starring the repository helps more people discover it.
