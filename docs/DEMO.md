# OpenCompress demo recording guide

A short real workflow GIF/video is the highest-value visual asset still missing from the repository.

## Target

Record a **15–25 second**, silent demo at **1280×720** or **1440×900**. Keep the UI large enough to read on a GitHub README.

## Storyboard

1. Start on an empty OpenCompress screen for ~1 second.
2. Drag 8–20 mixed product images into the drop zone.
3. Select **Auto Best local**.
4. Briefly show the WooCommerce preset or WebP output settings.
5. Click **Compress images**.
6. Show the completed batch summary and visible savings.
7. Drag the Before/After slider once.
8. Show the candidate comparison for one image.
9. End with the **Download ZIP** button and the savings summary visible.

## What the demo must communicate

The viewer should understand these four things without reading captions:

- batch workflow
- local/private processing
- visible before/after comparison
- one-click ZIP export

## Recording rules

- Use non-confidential sample images.
- Hide personal paths, browser profiles and unrelated tabs.
- Do not show reSmush.it in the main demo; the strongest differentiator is local-first processing.
- Keep mouse movement deliberate and avoid idle time.
- Prefer a real recording over a mocked animation.
- Crop out browser chrome if it distracts from the app.

## Suggested filename

```text
docs/opencompress-demo.gif
```

For better quality and smaller GitHub payloads, also keep an MP4/WebM source outside the repository and export the README GIF at roughly 12–15 FPS.

## README placement

Once the real GIF exists, replace the static preview line near the top of `README.md` with:

```markdown
![OpenCompress Studio demo](docs/opencompress-demo.gif)
```

Keep `docs/screenshot.svg` as a lightweight fallback/social asset source.
