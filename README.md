# OpenCompress Studio

OpenCompress Studio is a local browser-based batch image compressor for small e-commerce sellers, print shops, artists and content creators.

It lets you upload multiple images, compress them locally, resize them, convert them to JPG/PNG/WebP, compare before/after previews and download all optimized files as a ZIP batch.

The app runs on your own computer through a small local Node.js server. Local compression is handled with `sharp`. Optional external compression can be enabled with the reSmush.it API.

![OpenCompress Studio preview](docs/screenshot.svg)

> Add your own screenshot or workflow GIF to `docs/screenshot.svg`.

---

## Features

- Upload multiple JPG, PNG, WebP, GIF, TIF or BMP images
- Local image compression with `sharp`
- Optional reSmush.it API mode
- Auto mode: compare local result with reSmush.it and keep the smaller file
- JPG, PNG and WebP output
- Resize to maximum width and height
- Metadata removal by default
- Optional EXIF preservation for reSmush.it mode
- Before/after preview slider
- Batch results table with file savings
- ZIP export with all optimized files
- Presets for WooCommerce, Amazon, Etsy, Instagram and transparent PNG workflows
- Windows `start.bat` and `stop.bat` helper scripts
- GitHub Actions CI workflow

---

## Current status

OpenCompress Studio V2 is a release-ready local Vite/React + Node app.

| Mode | Works offline | Uploads images externally | Notes |
| --- | --- | --- | --- |
| Local only | Yes | No | Recommended default mode |
| reSmush.it API | No | Yes | Optional external compression |
| Auto | No | Yes, for comparison | Uses smaller result when available |

The default mode is **Local only** so your images stay on your computer.

---

## Privacy note

Local compression keeps images on your own computer.

reSmush.it mode uploads selected images to the external reSmush.it API for compression. Do not use reSmush.it mode with confidential files unless you understand this workflow.

Runtime output files are temporary and are stored in the local `.opencompress/` folder. They are cleaned up automatically after the configured job TTL.

---

## reSmush.it note

reSmush.it support is optional.

The app checks file size and format before using reSmush.it. Files that are too large or unsupported automatically fall back to local compression when possible.

Supported by the app for reSmush.it mode:

```text
JPG, PNG, GIF, TIF, BMP
```

Not supported by reSmush.it mode:

```text
WebP, AVIF, PSD, AI upscaling
```

WebP files can still be processed locally.

---

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- A modern Chromium, Firefox or Safari browser
- Internet connection only when using reSmush.it mode

---

## Windows one-click start

For non-technical Windows users, the release includes helper files in the project root:

```text
start.bat   Start the local app and install dependencies when needed
stop.bat    Stop the local server
```

Double-click `start.bat`.

The script checks for Node.js and npm, tries to install Node.js LTS with `winget` if missing, installs project dependencies with `npm install` when needed, starts the local server and opens:

```text
http://127.0.0.1:5174
```

Keep the terminal window open while using the app.

Use `stop.bat` to stop the server.

Optional custom port:

```bat
set OPENCOMPRESS_PORT=5180
start.bat
```

---

## Quick start for developers

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5174
```

---

## Production build

Create a production build:

```bash
npm run build
```

Run the production server locally:

```bash
npm start
```

Open:

```text
http://127.0.0.1:5174
```

---

## Useful scripts

```bash
npm run dev              # Start local dev server with API and Vite middleware
npm start                # Start production server from dist
npm run build            # Type-check and build production assets
npm run typecheck        # Run TypeScript checks
npm run typecheck:strict # TypeScript checks with unused-code detection
npm run clean            # Remove generated folders such as dist, node_modules and .opencompress
```

---

## Environment variables

```bash
OPENCOMPRESS_PORT=5174
OPENCOMPRESS_HOST=127.0.0.1
OPENCOMPRESS_MAX_UPLOAD_MB=100
OPENCOMPRESS_JOB_TTL_MS=3600000
OPENCOMPRESS_PUBLIC_REFERER=https://github.com/your-name/opencompress-studio
OPENCOMPRESS_USER_AGENT=OpenCompress-Studio/0.2.0
```

---

## Workflow

1. Upload one or more images.
2. Choose a compression method.
3. Pick an output format and quality.
4. Enable resize if needed.
5. Click **Compress images**.
6. Compare before/after preview.
7. Download the ZIP batch.

---

## Repository hygiene

The release package intentionally excludes:

```text
node_modules/
dist/
.opencompress/
local test images
ZIP exports
runtime logs
```

Install dependencies locally after cloning:

```bash
npm install
```

---

## Roadmap

Planned or recommended future improvements:

- AVIF output
- Browser-only light mode for static hosting
- Drag-and-drop image ordering
- Batch rename and SEO file names
- Target file size mode, for example "make every image under 300 KB"
- Advanced artifact detection / quality scoring
- Optional AI upscaling backend with Real-ESRGAN
- Product-image enhancement presets
- Docker image for VPS hosting

---

## Contributing

Issues and pull requests are welcome.

Before submitting changes, please run:

```bash
npm run typecheck:strict
npm run build
```

Do not commit:

```text
node_modules/
dist/
.opencompress/
private images
local runtime logs
ZIP exports
```

---

## License

MIT License. See `LICENSE` for details.
