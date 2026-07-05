import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ZipFile } = require('yazl');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const runtimeDir = path.join(rootDir, '.opencompress');
const jobsDir = path.join(runtimeDir, 'jobs');
const distDir = path.join(rootDir, 'dist');

const port = Number(process.env.OPENCOMPRESS_PORT || 5174);
const host = process.env.OPENCOMPRESS_HOST || '127.0.0.1';
const maxUploadMb = Number(process.env.OPENCOMPRESS_MAX_UPLOAD_MB || 100);
const jobTtlMs = Number(process.env.OPENCOMPRESS_JOB_TTL_MS || 60 * 60 * 1000);
const isProduction = process.argv.includes('--production') || process.env.NODE_ENV === 'production';

mkdirSync(jobsDir, { recursive: true });

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxUploadMb * 1024 * 1024,
    files: 250
  }
});

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: '0.2.0', maxUploadMb, jobTtlMs });
});

app.post('/api/jobs', upload.array('images', 250), async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) {
    res.status(400).json({ error: 'No images uploaded.' });
    return;
  }

  const settings = parseSettings(req.body.settings);
  const jobId = crypto.randomUUID();
  const jobDir = path.join(jobsDir, jobId);
  mkdirSync(jobDir, { recursive: true });

  const results = [];
  for (const file of files) {
    const started = Date.now();
    try {
      const result = await processOneImage(file, settings, jobDir, jobId);
      results.push({ ...result, durationMs: Date.now() - started });
    } catch (error) {
      results.push({
        originalName: file.originalname,
        inputSize: file.size,
        outputSize: file.size,
        savedBytes: 0,
        savedPercent: 0,
        status: 'failed',
        method: settings.mode,
        message: getErrorMessage(error),
        durationMs: Date.now() - started
      });
    }
  }

  const successful = results.filter((item) => item.status !== 'failed' && item.outputName);
  const zipPath = path.join(jobDir, 'opencompress-results.zip');
  if (successful.length) {
    await createZip(jobDir, zipPath, successful);
  }

  const manifest = {
    jobId,
    createdAt: new Date().toISOString(),
    settings,
    results
  };
  writeFileSync(path.join(jobDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const totalOriginal = results.reduce((sum, item) => sum + Number(item.inputSize || 0), 0);
  const totalOutput = results.reduce((sum, item) => sum + Number(item.outputSize || item.inputSize || 0), 0);
  const savedBytes = Math.max(0, totalOriginal - totalOutput);
  const savedPercent = totalOriginal ? Math.round((savedBytes / totalOriginal) * 1000) / 10 : 0;

  res.json({
    jobId,
    downloadUrl: successful.length ? `/api/jobs/${jobId}/download` : null,
    results,
    totals: { totalOriginal, totalOutput, savedBytes, savedPercent }
  });
});

app.get('/api/jobs/:jobId/download', async (req, res) => {
  const jobId = sanitizeId(req.params.jobId);
  const zipPath = path.join(jobsDir, jobId, 'opencompress-results.zip');
  if (!existsSync(zipPath)) {
    res.status(404).json({ error: 'ZIP result not found or expired.' });
    return;
  }
  const zipBuffer = await readFile(zipPath);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="opencompress-results.zip"');
  res.send(zipBuffer);
});

app.get('/api/jobs/:jobId/files/:fileName', async (req, res) => {
  const jobId = sanitizeId(req.params.jobId);
  const fileName = path.basename(req.params.fileName);
  const filePath = path.join(jobsDir, jobId, fileName);
  if (!existsSync(filePath)) {
    res.status(404).json({ error: 'File not found or expired.' });
    return;
  }
  const data = await readFile(filePath);
  res.setHeader('Content-Type', contentTypeFromExtension(fileName));
  res.send(data);
});

app.delete('/api/jobs/:jobId', (req, res) => {
  const jobId = sanitizeId(req.params.jobId);
  const jobDir = path.join(jobsDir, jobId);
  rmSync(jobDir, { recursive: true, force: true });
  res.json({ ok: true });
});

if (isProduction) {
  if (!existsSync(distDir)) {
    console.error('[opencompress] Missing dist folder. Run npm run build first.');
    process.exit(1);
  }
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root: rootDir,
    server: { middlewareMode: true, host, port, strictPort: true },
    appType: 'spa'
  });
  app.use(vite.middlewares);
}

setInterval(cleanOldJobs, Math.min(jobTtlMs, 15 * 60 * 1000)).unref();
cleanOldJobs();

app.listen(port, host, () => {
  const mode = isProduction ? 'production' : 'development';
  console.log(`[opencompress] ${mode} server running at http://${host}:${port}`);
  console.log(`[opencompress] Max upload size: ${maxUploadMb} MB per file`);
});

function parseSettings(raw) {
  const parsed = raw ? JSON.parse(String(raw)) : {};
  const mode = ['local', 'resmush', 'auto'].includes(parsed.mode) ? parsed.mode : 'local';
  const format = ['original', 'jpeg', 'png', 'webp'].includes(parsed.format) ? parsed.format : 'webp';
  const quality = clampNumber(parsed.quality, 1, 100, 82);
  const resizeEnabled = Boolean(parsed.resizeEnabled);
  const maxWidth = clampNumber(parsed.maxWidth, 1, 20000, 1600);
  const maxHeight = clampNumber(parsed.maxHeight, 1, 20000, 1600);
  const keepMetadata = Boolean(parsed.keepMetadata);
  const keepExif = Boolean(parsed.keepExif);
  const resmushQuality = clampNumber(parsed.resmushQuality ?? quality, 0, 100, 92);
  return { mode, format, quality, resizeEnabled, maxWidth, maxHeight, keepMetadata, keepExif, resmushQuality };
}

async function processOneImage(file, settings, jobDir, jobId) {
  const input = file.buffer;
  const originalName = file.originalname || 'image';
  const inputSize = input.length;
  const mime = file.mimetype || guessMime(originalName);
  const baseName = sanitizeBaseName(originalName);

  const local = async () => compressLocal(input, settings, mime);
  const external = async () => compressResmush(input, originalName, mime, settings);

  let selected;
  let method;
  let message = '';

  if (settings.mode === 'local') {
    selected = await local();
    method = 'local';
  } else if (settings.mode === 'resmush') {
    try {
      selected = await external();
      method = 'resmush';
    } catch (error) {
      selected = await local();
      method = 'local-fallback';
      message = `reSmush.it failed: ${getErrorMessage(error)} Local compression was used.`;
    }
  } else {
    const localResult = await local();
    try {
      const externalResult = await external();
      if (externalResult.buffer.length < localResult.buffer.length) {
        selected = externalResult;
        method = 'resmush';
      } else {
        selected = localResult;
        method = 'local';
        message = 'Local compression was smaller than reSmush.it.';
      }
    } catch (error) {
      selected = localResult;
      method = 'local-fallback';
      message = `reSmush.it failed: ${getErrorMessage(error)} Local compression was used.`;
    }
  }

  const outputExt = selected.extension || extensionFromFormat(selected.format);
  const outputName = uniqueOutputName(jobDir, `${baseName}.${outputExt}`);
  const outputPath = path.join(jobDir, outputName);
  writeFileSync(outputPath, selected.buffer);

  const outputSize = selected.buffer.length;
  const savedBytes = inputSize - outputSize;
  const savedPercent = inputSize ? Math.round((savedBytes / inputSize) * 1000) / 10 : 0;

  return {
    originalName,
    outputName,
    previewUrl: `/api/jobs/${jobId}/files/${encodeURIComponent(outputName)}`,
    inputSize,
    outputSize,
    savedBytes,
    savedPercent,
    width: selected.width || null,
    height: selected.height || null,
    format: selected.format,
    method,
    status: outputSize <= inputSize ? 'optimized' : 'converted',
    message
  };
}

async function compressLocal(input, settings, mime) {
  let image = sharp(input, { failOn: 'none', animated: false }).rotate();

  if (settings.resizeEnabled) {
    image = image.resize({
      width: settings.maxWidth,
      height: settings.maxHeight,
      fit: 'inside',
      withoutEnlargement: true
    });
  }

  const targetFormat = resolveTargetFormat(settings.format, mime);
  if (settings.keepMetadata) {
    image = image.withMetadata();
  }

  if (targetFormat === 'jpeg') {
    image = image.flatten({ background: '#ffffff' }).jpeg({ quality: settings.quality, mozjpeg: true });
  } else if (targetFormat === 'png') {
    image = image.png({ compressionLevel: 9, effort: 10, palette: true, quality: settings.quality });
  } else if (targetFormat === 'webp') {
    image = image.webp({ quality: settings.quality, effort: 5 });
  } else {
    image = image.png({ compressionLevel: 9, effort: 10 });
  }

  const { data, info } = await image.toBuffer({ resolveWithObject: true });
  return { buffer: data, format: info.format, width: info.width, height: info.height, extension: extensionFromFormat(info.format) };
}

async function compressResmush(input, originalName, mime, settings) {
  if (input.length >= 5 * 1024 * 1024) {
    throw new Error('File is too large for reSmush.it. Maximum supported size is under 5 MB.');
  }

  const supported = ['image/jpeg', 'image/png', 'image/gif', 'image/tiff', 'image/bmp', 'image/x-ms-bmp'];
  if (!supported.includes(mime)) {
    throw new Error('Unsupported file format for reSmush.it. Supported formats are JPG, PNG, GIF, TIF and BMP.');
  }

  const params = new URLSearchParams({ qlty: String(settings.resmushQuality) });
  if (settings.keepExif) params.set('exif', 'true');
  const formData = new FormData();
  formData.append('files', new Blob([input], { type: mime }), originalName);

  const response = await fetch(`https://api.resmush.it/?${params.toString()}`, {
    method: 'POST',
    body: formData,
    headers: {
      'User-Agent': process.env.OPENCOMPRESS_USER_AGENT || 'OpenCompress-Studio/0.2.0',
      Referer: process.env.OPENCOMPRESS_PUBLIC_REFERER || 'https://github.com/opencompress-studio/opencompress-studio'
    }
  });

  if (!response.ok) {
    throw new Error(`reSmush.it HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error_log || data.error || 'reSmush.it returned an error.');
  }
  if (!data.dest) {
    throw new Error('reSmush.it response did not include an optimized file URL.');
  }

  const optimized = await fetch(data.dest, {
    headers: {
      'User-Agent': process.env.OPENCOMPRESS_USER_AGENT || 'OpenCompress-Studio/0.2.0',
      Referer: process.env.OPENCOMPRESS_PUBLIC_REFERER || 'https://github.com/opencompress-studio/opencompress-studio'
    }
  });
  if (!optimized.ok) {
    throw new Error(`Could not download optimized reSmush.it result: HTTP ${optimized.status}`);
  }

  const arrayBuffer = await optimized.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  let metadata = {};
  try {
    metadata = await sharp(buffer, { failOn: 'none' }).metadata();
  } catch {
    metadata = {};
  }

  return {
    buffer,
    format: metadata.format || formatFromMime(mime),
    width: metadata.width,
    height: metadata.height,
    extension: extensionFromFormat(metadata.format || formatFromMime(mime))
  };
}

async function createZip(jobDir, zipPath, results) {
  await new Promise((resolve, reject) => {
    const zipFile = new ZipFile();
    const output = createWriteStream(zipPath);

    output.on('close', resolve);
    output.on('error', reject);
    zipFile.outputStream.on('error', reject);
    zipFile.outputStream.pipe(output);

    for (const result of results) {
      zipFile.addFile(path.join(jobDir, result.outputName), result.outputName);
    }

    zipFile.addBuffer(Buffer.from(JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)), 'opencompress-report.json');
    zipFile.end();
  });
}

function cleanOldJobs() {
  const now = Date.now();
  if (!existsSync(jobsDir)) return;
  for (const entry of readdirSync(jobsDir)) {
    const jobDir = path.join(jobsDir, entry);
    try {
      const stats = statSync(jobDir);
      if (stats.isDirectory() && now - stats.mtimeMs > jobTtlMs) {
        rmSync(jobDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup races.
    }
  }
}

function sanitizeId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9-]/g, '');
}

function sanitizeBaseName(fileName) {
  const parsed = path.parse(fileName || 'image');
  const clean = parsed.name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return clean || 'image';
}

function uniqueOutputName(jobDir, desiredName) {
  const parsed = path.parse(desiredName);
  let candidate = desiredName;
  let index = 2;
  while (existsSync(path.join(jobDir, candidate))) {
    candidate = `${parsed.name}-${index}${parsed.ext}`;
    index += 1;
  }
  return candidate;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function resolveTargetFormat(format, mime) {
  if (format !== 'original') return format;
  const detected = formatFromMime(mime);
  return ['jpeg', 'png', 'webp'].includes(detected) ? detected : 'png';
}

function formatFromMime(mime) {
  if (/jpe?g/i.test(mime)) return 'jpeg';
  if (/png/i.test(mime)) return 'png';
  if (/webp/i.test(mime)) return 'webp';
  if (/gif/i.test(mime)) return 'gif';
  if (/tiff?/i.test(mime)) return 'tiff';
  if (/bmp/i.test(mime)) return 'bmp';
  return 'png';
}

function guessMime(fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  if (['.jpg', '.jpeg'].includes(ext)) return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (['.tif', '.tiff'].includes(ext)) return 'image/tiff';
  if (ext === '.bmp') return 'image/bmp';
  return 'application/octet-stream';
}

function contentTypeFromExtension(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.tif' || ext === '.tiff') return 'image/tiff';
  if (ext === '.bmp') return 'image/bmp';
  return 'application/octet-stream';
}

function extensionFromFormat(format) {
  if (format === 'jpeg') return 'jpg';
  if (format === 'tiff') return 'tif';
  if (format === 'webp') return 'webp';
  if (format === 'png') return 'png';
  if (format === 'gif') return 'gif';
  if (format === 'bmp') return 'bmp';
  return 'png';
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
