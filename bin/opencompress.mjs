#!/usr/bin/env node

import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const VERSION = '2.1.0';
const SUPPORTED_INPUTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp']);
const FORMAT_ALIASES = new Map([
  ['jpg', 'jpeg'],
  ['jpeg', 'jpeg'],
  ['png', 'png'],
  ['webp', 'webp']
]);
const FORMAT_EXTENSION = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp'
};

main().catch((error) => {
  console.error(`[opencompress-cli] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.version) {
    console.log(VERSION);
    return;
  }

  if (!options.inputs.length) {
    throw new Error('No input files or directories supplied. Run with --help for usage.');
  }

  if (options.targetSizeKb && !options.autoBest && options.format === 'png') {
    throw new Error('--target-size-kb supports JPG/WebP output. Use --auto-best if you want PNG to participate as an additional candidate.');
  }

  const outputDir = path.resolve(options.output);
  const files = await collectInputFiles(options.inputs, options.recursive, outputDir);
  if (!files.length) {
    throw new Error('No supported images found. Supported inputs: JPG, PNG, WebP, TIFF and BMP.');
  }

  await mkdir(outputDir, { recursive: true });

  const results = [];
  for (const filePath of files) {
    try {
      const result = await processImage(filePath, outputDir, options);
      results.push(result);
      if (!options.json) printResult(result);
    } catch (error) {
      const failure = {
        input: filePath,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      };
      results.push(failure);
      if (!options.json) console.error(`FAILED ${filePath}: ${failure.error}`);
    }
  }

  const successful = results.filter((item) => item.status !== 'failed');
  const failed = results.length - successful.length;
  const totalInputBytes = successful.reduce((sum, item) => sum + item.inputBytes, 0);
  const totalOutputBytes = successful.reduce((sum, item) => sum + item.outputBytes, 0);
  const savedBytes = totalInputBytes - totalOutputBytes;
  const savedPercent = totalInputBytes > 0 ? roundOne((savedBytes / totalInputBytes) * 100) : 0;

  const summary = {
    version: VERSION,
    mode: options.autoBest ? 'auto-best' : options.targetSizeKb ? 'target-size' : 'local',
    targetSizeKb: options.targetSizeKb,
    outputDir,
    processed: successful.length,
    failed,
    totalInputBytes,
    totalOutputBytes,
    savedBytes,
    savedPercent,
    results
  };

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log('');
    console.log(`Processed ${successful.length}/${results.length} image(s).`);
    console.log(`Total: ${formatBytes(totalInputBytes)} -> ${formatBytes(totalOutputBytes)} (${formatSavings(savedPercent)}).`);
    console.log(`Output: ${outputDir}`);
  }

  if (failed > 0) process.exitCode = 1;
}

function parseArgs(argv) {
  const options = {
    inputs: [],
    output: 'opencompress-output',
    format: 'webp',
    quality: 82,
    maxWidth: null,
    maxHeight: null,
    recursive: false,
    autoBest: false,
    targetSizeKb: null,
    keepOriginalIfLarger: true,
    background: '#ffffff',
    json: false,
    help: false,
    version: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('-')) {
      options.inputs.push(arg);
      continue;
    }

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--version':
        options.version = true;
        break;
      case '-o':
      case '--output':
        options.output = readValue(argv, ++index, arg);
        break;
      case '-f':
      case '--format': {
        const raw = readValue(argv, ++index, arg).toLowerCase();
        const format = FORMAT_ALIASES.get(raw);
        if (!format) throw new Error(`Unsupported format "${raw}". Use webp, jpg/jpeg or png.`);
        options.format = format;
        break;
      }
      case '-q':
      case '--quality':
        options.quality = readInteger(argv, ++index, arg, 1, 100);
        break;
      case '--max-width':
        options.maxWidth = readInteger(argv, ++index, arg, 1, 20000);
        break;
      case '--max-height':
        options.maxHeight = readInteger(argv, ++index, arg, 1, 20000);
        break;
      case '-r':
      case '--recursive':
        options.recursive = true;
        break;
      case '--auto-best':
        options.autoBest = true;
        break;
      case '--target-size':
      case '--target-size-kb':
        options.targetSizeKb = readInteger(argv, ++index, arg, 10, 100000);
        break;
      case '--allow-larger':
        options.keepOriginalIfLarger = false;
        break;
      case '--background': {
        const value = readValue(argv, ++index, arg);
        if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
          throw new Error('--background must be a six-digit hex color such as #ffffff.');
        }
        options.background = value;
        break;
      }
      case '--json':
        options.json = true;
        break;
      default:
        throw new Error(`Unknown option "${arg}". Run with --help for usage.`);
    }
  }

  return options;
}

function readValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('-')) throw new Error(`${flag} requires a value.`);
  return value;
}

function readInteger(argv, index, flag, min, max) {
  const raw = readValue(argv, index, flag);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${flag} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

async function collectInputFiles(inputs, recursive, outputDir) {
  const collected = new Set();

  for (const input of inputs) {
    const resolved = path.resolve(input);
    let info;
    try {
      info = await stat(resolved);
    } catch {
      throw new Error(`Input does not exist: ${input}`);
    }

    if (info.isFile()) {
      if (!isSupportedInput(resolved)) throw new Error(`Unsupported image type: ${input}`);
      collected.add(resolved);
      continue;
    }

    if (!info.isDirectory()) throw new Error(`Input is not a file or directory: ${input}`);
    await walkDirectory(resolved, recursive, outputDir, collected);
  }

  return [...collected].sort((a, b) => a.localeCompare(b));
}

async function walkDirectory(directory, recursive, outputDir, collected) {
  if (samePath(directory, outputDir)) return;
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isFile() && isSupportedInput(fullPath)) {
      collected.add(fullPath);
    } else if (recursive && entry.isDirectory() && !samePath(fullPath, outputDir)) {
      await walkDirectory(fullPath, true, outputDir, collected);
    }
  }
}

function samePath(a, b) {
  return path.resolve(a) === path.resolve(b);
}

function isSupportedInput(filePath) {
  return SUPPORTED_INPUTS.has(path.extname(filePath).toLowerCase());
}

async function processImage(inputPath, outputDir, options) {
  const inputInfo = await stat(inputPath);
  const metadata = await sharp(inputPath, { failOn: 'none' }).metadata();
  const inputBytes = inputInfo.size;
  const stem = path.parse(inputPath).name;

  let selected;
  let candidates = [];
  let message = '';

  if (options.autoBest) {
    const best = await compressAutoBest(inputPath, options, metadata);
    selected = best.selected;
    candidates = best.candidates;
    message = best.message;
  } else {
    selected = await compressLocal(inputPath, options.format, options, metadata);
  }

  if (options.keepOriginalIfLarger && selected.buffer.length > inputBytes) {
    const originalExtension = path.extname(inputPath).toLowerCase();
    const outputPath = uniqueOutputPath(outputDir, stem, originalExtension);
    await copyFile(inputPath, outputPath);
    return {
      input: inputPath,
      output: outputPath,
      status: 'original-kept',
      method: 'original-kept',
      format: normalizeFormat(metadata.format),
      quality: null,
      inputBytes,
      outputBytes: inputBytes,
      savedBytes: 0,
      savedPercent: 0,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      targetBytes: options.targetSizeKb ? options.targetSizeKb * 1024 : null,
      targetReached: selected.targetReached ?? null,
      candidates,
      message: [message, 'Optimized result was larger, so the original file was kept.'].filter(Boolean).join(' ')
    };
  }

  const extension = FORMAT_EXTENSION[selected.format] || path.extname(inputPath).toLowerCase();
  const outputPath = uniqueOutputPath(outputDir, stem, extension);
  await writeFile(outputPath, selected.buffer);

  const savedBytes = inputBytes - selected.buffer.length;
  const savedPercent = inputBytes > 0 ? roundOne((savedBytes / inputBytes) * 100) : 0;
  return {
    input: inputPath,
    output: outputPath,
    status: selected.buffer.length < inputBytes ? 'optimized' : selected.buffer.length === inputBytes ? 'same-size' : 'larger',
    method: selected.method,
    format: selected.format,
    quality: selected.quality ?? null,
    inputBytes,
    outputBytes: selected.buffer.length,
    savedBytes,
    savedPercent,
    width: selected.width ?? null,
    height: selected.height ?? null,
    targetBytes: options.targetSizeKb ? options.targetSizeKb * 1024 : null,
    targetReached: selected.targetReached ?? null,
    candidates,
    message
  };
}

async function compressLocal(inputPath, format, options, metadata) {
  const targetBytes = options.targetSizeKb && isQualityFormat(format) ? options.targetSizeKb * 1024 : null;
  const build = (quality) => buildSharpPipeline(inputPath, options, format, quality, metadata);

  if (targetBytes) {
    const target = await encodeToTargetSize(build, targetBytes, options.quality);
    return {
      ...target,
      method: `local-target-${format}`
    };
  }

  const { data, info } = await build(options.quality).toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    format: normalizeFormat(info.format || format),
    width: info.width ?? null,
    height: info.height ?? null,
    quality: format === 'png' ? options.quality : options.quality,
    targetReached: null,
    method: `local-${format}`
  };
}

function buildSharpPipeline(inputPath, options, format, quality, metadata) {
  let pipeline = sharp(inputPath, { failOn: 'none', animated: false }).rotate();

  if (options.maxWidth || options.maxHeight) {
    pipeline = pipeline.resize({
      width: options.maxWidth ?? undefined,
      height: options.maxHeight ?? undefined,
      fit: 'inside',
      withoutEnlargement: true
    });
  }

  if (format === 'jpeg') {
    pipeline = pipeline.flatten({ background: options.background }).jpeg({ quality, mozjpeg: true });
  } else if (format === 'png') {
    pipeline = pipeline.png({ compressionLevel: 9, effort: 10, palette: true, quality });
  } else {
    pipeline = pipeline.webp({ quality, effort: 5, alphaQuality: metadata.hasAlpha ? quality : undefined });
  }

  return pipeline;
}

async function encodeToTargetSize(build, targetBytes, preferredQuality) {
  let low = 1;
  let high = Math.min(100, Math.max(1, preferredQuality));
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

async function compressAutoBest(inputPath, options, metadata) {
  const hasAlpha = Boolean(metadata.hasAlpha);
  const formats = hasAlpha ? ['webp', 'png'] : ['webp', 'jpeg'];
  if (!formats.includes(options.format)) formats.unshift(options.format);

  const candidates = [];
  const valid = [];

  for (const format of [...new Set(formats)]) {
    try {
      const result = await compressLocal(inputPath, format, options, metadata);
      result.method = `auto-best-${format}${options.targetSizeKb && isQualityFormat(format) ? '-target' : ''}`;
      valid.push(result);
      candidates.push(toCandidateSummary(result));
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
    message: `Auto Best selected ${selected.format.toUpperCase()} as the smallest local result.`
  };
}

function toCandidateSummary(result) {
  return {
    method: result.method,
    size: result.buffer.length,
    format: result.format,
    quality: result.quality ?? null,
    width: result.width ?? null,
    height: result.height ?? null,
    targetReached: result.targetReached ?? null
  };
}

function isQualityFormat(format) {
  return format === 'jpeg' || format === 'webp';
}

function uniqueOutputPath(outputDir, stem, extension) {
  let counter = 1;
  let candidate = path.join(outputDir, `${stem}${extension}`);
  while (existsSync(candidate)) {
    counter += 1;
    candidate = path.join(outputDir, `${stem}-${counter}${extension}`);
  }
  return candidate;
}

function normalizeFormat(value) {
  if (value === 'jpg') return 'jpeg';
  return value || 'original';
}

function printResult(result) {
  const label = result.status === 'original-kept' ? 'KEPT' : 'OK';
  const mode = result.method ? ` | ${result.method}` : '';
  const target = result.targetBytes
    ? ` | target ${formatBytes(result.targetBytes)} ${result.targetReached === true ? 'reached' : result.targetReached === false ? 'not reached' : 'n/a'}`
    : '';
  console.log(`${label} ${path.basename(result.input)} -> ${path.basename(result.output)} | ${formatBytes(result.inputBytes)} -> ${formatBytes(result.outputBytes)} | ${formatSavings(result.savedPercent)}${mode}${target}`);
}

function formatSavings(percent) {
  if (percent > 0) return `${percent}% smaller`;
  if (percent < 0) return `${Math.abs(percent)}% larger`;
  return 'same size';
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function printHelp() {
  console.log(`OpenCompress CLI ${VERSION}\n\nUsage:\n  npm run cli -- <files-or-directories...> [options]\n  node bin/opencompress.mjs <files-or-directories...> [options]\n\nOptions:\n  -o, --output <dir>       Output directory (default: opencompress-output)\n  -f, --format <format>    webp, jpg/jpeg or png (default: webp)\n  -q, --quality <1-100>    Preferred lossy quality (default: 82)\n      --auto-best          Test local candidates and keep the smallest\n      --target-size <KB>   Alias for --target-size-kb\n      --target-size-kb <KB> Search highest JPG/WebP quality under target\n      --max-width <px>     Resize to fit within this width\n      --max-height <px>    Resize to fit within this height\n  -r, --recursive          Scan nested directories\n      --allow-larger       Keep optimized output even when it is larger\n      --background <hex>   JPG alpha background (default: #ffffff)\n      --json               Print machine-readable JSON summary\n  -v, --version            Print version\n  -h, --help               Show this help\n\nSupported inputs:\n  JPG, PNG, WebP, TIFF and BMP\n\nExamples:\n  npm run cli -- ./images --format webp --quality 82 --max-width 1600\n  npm run cli -- ./catalog --recursive --auto-best -o ./optimized\n  npm run cli -- hero.jpg --format webp --target-size-kb 300 --json\n  npm run cli -- ./products --auto-best --target-size 250 --max-width 1600\n\nAuto Best mirrors the local GUI strategy: WebP + JPEG for images without alpha, and WebP + PNG for images with alpha. If --format adds a different candidate, it is tested too. Target-size search uses up to seven quality-search steps for JPG/WebP and reports targetReached in JSON.\n\nThe CLI is local-only. It does not call reSmush.it or any other external image service.`);
}
