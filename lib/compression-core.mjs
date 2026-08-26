import sharp from 'sharp';

const QUALITY_FORMATS = new Set(['jpeg', 'webp']);
const OUTPUT_FORMATS = new Set(['original', 'jpeg', 'png', 'webp']);

export function normalizeFormat(value) {
  if (value === 'jpg') return 'jpeg';
  return value || 'original';
}

export function isQualityFormat(format) {
  return QUALITY_FORMATS.has(normalizeFormat(format));
}

export function extensionFromFormat(format) {
  const normalized = normalizeFormat(format);
  if (normalized === 'jpeg') return 'jpg';
  if (normalized === 'tiff') return 'tif';
  if (normalized === 'webp') return 'webp';
  if (normalized === 'png') return 'png';
  if (normalized === 'gif') return 'gif';
  if (normalized === 'bmp') return 'bmp';
  return 'png';
}

export function formatFromMime(mime) {
  if (/jpe?g/i.test(mime)) return 'jpeg';
  if (/png/i.test(mime)) return 'png';
  if (/webp/i.test(mime)) return 'webp';
  if (/gif/i.test(mime)) return 'gif';
  if (/tiff?/i.test(mime)) return 'tiff';
  if (/bmp/i.test(mime)) return 'bmp';
  return 'png';
}

export function resolveTargetFormat(format, mime = '', detectedFormat = '') {
  const normalized = normalizeFormat(format);
  if (normalized !== 'original') return OUTPUT_FORMATS.has(normalized) ? normalized : 'webp';
  const detected = normalizeFormat(detectedFormat || formatFromMime(mime));
  return ['jpeg', 'png', 'webp'].includes(detected) ? detected : 'png';
}

export async function readMetadata(input, fallback = {}) {
  try {
    return await sharp(input, { failOn: 'none' }).metadata();
  } catch {
    return fallback || {};
  }
}

export function buildSharpPipeline(input, settings, targetFormat, quality, metadata = {}) {
  const normalized = normalizeCoreSettings(settings);
  let image = sharp(input, { failOn: 'none', animated: false }).rotate();

  if (normalized.resizeEnabled) {
    image = image.resize({
      width: normalized.maxWidth ?? undefined,
      height: normalized.maxHeight ?? undefined,
      fit: 'inside',
      withoutEnlargement: true
    });
  }

  if (normalized.keepMetadata) image = image.withMetadata();

  if (targetFormat === 'jpeg') {
    image = image
      .flatten({ background: normalized.background })
      .jpeg({ quality, mozjpeg: true });
  } else if (targetFormat === 'png') {
    image = image.png({ compressionLevel: 9, effort: 10, palette: true, quality });
  } else if (targetFormat === 'webp') {
    image = image.webp({
      quality,
      effort: 5,
      alphaQuality: metadata.hasAlpha ? quality : undefined
    });
  } else {
    image = image.png({ compressionLevel: 9, effort: 10 });
  }

  return image;
}

export async function encodeToTargetSize(build, targetBytes, preferredQuality) {
  let low = 1;
  let high = Math.min(100, Math.max(1, Number(preferredQuality) || 82));
  let bestUnder = null;
  let smallest = null;

  for (let step = 0; step < 7 && low <= high; step += 1) {
    const quality = Math.round((low + high) / 2);
    const { data, info } = await build(quality).toBuffer({ resolveWithObject: true });
    const result = {
      buffer: data,
      format: normalizeFormat(info.format),
      width: info.width ?? null,
      height: info.height ?? null,
      quality,
      targetReached: data.length <= targetBytes
    };

    if (!smallest || data.length < smallest.buffer.length) smallest = result;
    if (data.length <= targetBytes) {
      bestUnder = result;
      low = quality + 1;
    } else {
      high = quality - 1;
    }
  }

  if (!smallest) throw new Error('Target-size search could not produce an output candidate.');
  return bestUnder || { ...smallest, targetReached: false };
}

export async function compressLocal(input, settings = {}, mime = '', existingMetadata = null) {
  const normalized = normalizeCoreSettings(settings);
  const metadata = existingMetadata || await readMetadata(input);
  const targetFormat = resolveTargetFormat(normalized.format, mime, metadata.format);
  const targetBytes = normalized.targetSizeEnabled && isQualityFormat(targetFormat)
    ? normalized.targetSizeKb * 1024
    : null;

  const build = (quality) => buildSharpPipeline(input, normalized, targetFormat, quality, metadata);

  if (targetBytes) {
    const targetResult = await encodeToTargetSize(build, targetBytes, normalized.quality);
    return {
      ...targetResult,
      method: 'local-target',
      extension: extensionFromFormat(targetResult.format),
      requiresFlattenWarning: Boolean(metadata.hasAlpha) && targetFormat === 'jpeg'
    };
  }

  const { data, info } = await build(normalized.quality).toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    format: normalizeFormat(info.format || targetFormat),
    width: info.width ?? null,
    height: info.height ?? null,
    quality: normalized.quality,
    targetReached: null,
    extension: extensionFromFormat(info.format || targetFormat),
    method: 'local',
    requiresFlattenWarning: Boolean(metadata.hasAlpha) && targetFormat === 'jpeg'
  };
}

export async function compressAutoBest(input, settings = {}, mime = '', existingMetadata = null) {
  const normalized = normalizeCoreSettings(settings);
  const metadata = existingMetadata || await readMetadata(input);
  const hasAlpha = Boolean(metadata.hasAlpha);
  const formats = hasAlpha ? ['webp', 'png'] : ['webp', 'jpeg'];
  if (normalized.format !== 'original' && !formats.includes(normalized.format)) {
    formats.unshift(normalized.format);
  }

  const candidates = [];
  const valid = [];

  for (const format of [...new Set(formats)]) {
    try {
      const result = await compressLocal(input, { ...normalized, format }, mime, metadata);
      result.method = `auto-best-${format}`;
      valid.push(result);
      candidates.push(toCandidateSummary(result, result.method));
    } catch (error) {
      candidates.push({
        method: `auto-best-${format}`,
        format,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (!valid.length) throw new Error('Auto Best could not create any local candidate.');
  valid.sort((a, b) => a.buffer.length - b.buffer.length);
  const selected = valid[0];

  return {
    selected,
    candidates,
    message: `Auto Best selected ${String(selected.format || '').toUpperCase()} as the smallest local result.`
  };
}

export function toCandidateSummary(result, method = result?.method || 'local') {
  return {
    method,
    size: result?.buffer?.length || 0,
    format: result?.format || null,
    quality: result?.quality ?? null,
    width: result?.width ?? null,
    height: result?.height ?? null,
    targetReached: result?.targetReached ?? null
  };
}

function normalizeCoreSettings(settings = {}) {
  const format = normalizeFormat(settings.format || 'webp');
  const quality = clampInteger(settings.quality, 1, 100, 82);
  const maxWidth = optionalPositiveInteger(settings.maxWidth, 20000);
  const maxHeight = optionalPositiveInteger(settings.maxHeight, 20000);
  const resizeEnabled = settings.resizeEnabled === undefined
    ? Boolean(maxWidth || maxHeight)
    : Boolean(settings.resizeEnabled);
  const targetSizeKb = clampInteger(settings.targetSizeKb, 10, 100000, 300);
  const targetSizeEnabled = settings.targetSizeEnabled === undefined
    ? settings.targetSizeKb !== null && settings.targetSizeKb !== undefined
    : Boolean(settings.targetSizeEnabled);
  const background = /^#[0-9a-fA-F]{6}$/.test(String(settings.background || ''))
    ? String(settings.background)
    : '#ffffff';

  return {
    ...settings,
    format: OUTPUT_FORMATS.has(format) ? format : 'webp',
    quality,
    resizeEnabled,
    maxWidth,
    maxHeight,
    keepMetadata: Boolean(settings.keepMetadata),
    targetSizeEnabled,
    targetSizeKb,
    background
  };
}

function optionalPositiveInteger(value, max) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(1, Math.round(parsed)));
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}
