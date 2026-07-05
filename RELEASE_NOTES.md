# OpenCompress Studio 2.1.0

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

## Changed

- Local compression now reports original and output dimensions/formats.
- Auto Compare can run in a fair mode with no resize, original format and matching quality.
- ZIP report now includes settings and detailed result metadata.
- README updated for the V2.1 workflow.

## Notes

- reSmush.it remains optional and uploads selected files to an external API only when explicitly selected.
- Local only and Auto Best local modes do not upload images externally.
- `node_modules/`, `dist/` and `.opencompress/` are excluded from the release package.
