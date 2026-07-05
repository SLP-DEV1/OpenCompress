# Release Notes

## 2.0.1 - Public npm registry lockfile fix

- Replaced internal build-environment package tarball URLs in `package-lock.json` with public `registry.npmjs.org` URLs.
- Added `.npmrc` to force the public npm registry for local installs.
- This fixes `npm install` errors that referenced an internal build-environment registry.

# OpenCompress Studio V2.0.0

Initial public release package.

## Added

- Local batch image compression with Node.js and sharp
- Optional reSmush.it API compression mode
- Auto mode that keeps the smaller result
- JPG, PNG and WebP output
- Resize settings
- Metadata removal by default
- Before/after preview slider
- ZIP export with JSON report
- Windows start/stop helper files
- English GitHub README
- MIT License
- GitHub Actions CI workflow

## Notes

- Local only mode keeps images on the user's computer.
- reSmush.it mode uploads selected files to an external API.
- The release ZIP excludes node_modules, dist and runtime files.
