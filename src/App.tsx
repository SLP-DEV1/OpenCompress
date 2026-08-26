import { ChangeEvent, DragEvent, useMemo, useRef, useState } from 'react';
import BeforeAfterPreview from './components/BeforeAfterPreview';
import { formatBytes, formatSavings, supportedFile } from './lib/format';

type CompressionMode = 'local' | 'resmush' | 'auto' | 'best';
type OutputFormat = 'original' | 'jpeg' | 'png' | 'webp';

type Settings = {
  mode: CompressionMode;
  format: OutputFormat;
  quality: number;
  resizeEnabled: boolean;
  maxWidth: number;
  maxHeight: number;
  keepMetadata: boolean;
  keepExif: boolean;
  resmushQuality: number;
  fairCompare: boolean;
  targetSizeEnabled: boolean;
  targetSizeKb: number;
  keepOriginalIfLarger: boolean;
  background: string;
  renameEnabled: boolean;
  renameBase: string;
  renameStart: number;
  renamePad: number;
};

type CandidateSummary = {
  method: string;
  size?: number;
  format?: string | null;
  quality?: number | null;
  width?: number | null;
  height?: number | null;
  targetReached?: boolean | null;
  error?: string;
};

type ResultItem = {
  originalName: string;
  outputName?: string;
  previewUrl?: string;
  inputSize: number;
  outputSize: number;
  savedBytes: number;
  savedPercent: number;
  inputWidth?: number | null;
  inputHeight?: number | null;
  width?: number | null;
  height?: number | null;
  originalFormat?: string;
  format?: string;
  quality?: number | null;
  method: string;
  status: string;
  message?: string;
  warnings?: string[];
  candidates?: CandidateSummary[];
  targetBytes?: number | null;
  targetReached?: boolean | null;
  durationMs?: number;
};

type JobResponse = {
  jobId: string;
  downloadUrl: string | null;
  results: ResultItem[];
  totals: {
    totalOriginal: number;
    totalOutput: number;
    savedBytes: number;
    savedPercent: number;
  };
};

type LocalFile = {
  id: string;
  file: File;
  originalUrl: string;
};

const MAX_FILES = 250;

const defaultSettings: Settings = {
  mode: 'local',
  format: 'webp',
  quality: 82,
  resizeEnabled: true,
  maxWidth: 1600,
  maxHeight: 1600,
  keepMetadata: false,
  keepExif: false,
  resmushQuality: 92,
  fairCompare: false,
  targetSizeEnabled: false,
  targetSizeKb: 300,
  keepOriginalIfLarger: true,
  background: '#ffffff',
  renameEnabled: false,
  renameBase: 'optimized-image',
  renameStart: 1,
  renamePad: 3
};

const presetSettings: Record<string, Partial<Settings>> = {
  WooCommerce: { format: 'webp', quality: 82, resizeEnabled: true, maxWidth: 1600, maxHeight: 1600, keepMetadata: false, targetSizeEnabled: false },
  Amazon: { format: 'jpeg', quality: 90, resizeEnabled: true, maxWidth: 2000, maxHeight: 2000, keepMetadata: false, background: '#ffffff' },
  Etsy: { format: 'jpeg', quality: 86, resizeEnabled: true, maxWidth: 2000, maxHeight: 2000, keepMetadata: false, background: '#ffffff' },
  Instagram: { format: 'jpeg', quality: 85, resizeEnabled: true, maxWidth: 1080, maxHeight: 1350, keepMetadata: false, background: '#ffffff' },
  TransparentPNG: { format: 'png', quality: 90, resizeEnabled: false, keepMetadata: false, targetSizeEnabled: false },
  SmallWeb: { format: 'webp', quality: 78, resizeEnabled: true, maxWidth: 1200, maxHeight: 1200, keepMetadata: false, targetSizeEnabled: true, targetSizeKb: 250 }
};

export default function App() {
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isProcessing, setIsProcessing] = useState(false);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeResult = job?.results[activeIndex] || null;
  const activeOriginal = files[activeIndex]?.originalUrl || null;
  const activeOptimized = activeResult?.previewUrl || null;
  const failedCount = job?.results.filter((item) => item.status === 'failed').length || 0;
  const optimizedCount = job?.results.filter((item) => item.status !== 'failed').length || 0;
  const warningCount = job?.results.reduce((sum, item) => sum + (item.warnings?.length || 0), 0) || 0;
  const totalInput = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files]);
  const transparencyRisk = settings.format === 'jpeg' && files.some((item) => /\.png$|\.webp$/i.test(item.file.name));
  const targetApplies = settings.targetSizeEnabled && ['jpeg', 'webp'].includes(settings.format) && settings.mode !== 'best';

  function updateSettings(patch: Partial<Settings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function addFiles(selectedFiles: FileList | File[]) {
    const supported = Array.from(selectedFiles).filter(supportedFile);
    if (!supported.length) {
      setError('Please select JPG, PNG, WebP, GIF, TIF or BMP images.');
      return;
    }

    const room = Math.max(0, MAX_FILES - files.length);
    const incoming = supported.slice(0, room);
    if (!incoming.length) {
      setError(`A batch can contain at most ${MAX_FILES} images.`);
      return;
    }

    setError(incoming.length < supported.length ? `Only the first ${MAX_FILES} images were added. Split larger batches into multiple runs.` : null);
    setJob(null);
    setFiles((current) => [
      ...current,
      ...incoming.map((file) => ({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        originalUrl: URL.createObjectURL(file)
      }))
    ]);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  }

  function clearFiles() {
    for (const item of files) URL.revokeObjectURL(item.originalUrl);
    setFiles([]);
    setJob(null);
    setActiveIndex(0);
    setError(null);
  }

  function cancelProcessing() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsProcessing(false);
    setError('Batch was cancelled. Already-created temporary files will expire automatically.');
  }

  async function processImages() {
    if (!files.length) {
      setError('Upload at least one image first.');
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setIsProcessing(true);
    setError(null);
    setJob(null);
    setActiveIndex(0);

    try {
      const formData = new FormData();
      for (const item of files) formData.append('images', item.file, item.file.name);
      formData.append('settings', JSON.stringify(settings));

      const response = await fetch('/api/jobs', { method: 'POST', body: formData, signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Compression failed.');
      setJob(data as JobResponse);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setError('Batch was cancelled.');
      } else {
        setError(caught instanceof Error ? caught.message : 'Compression failed.');
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsProcessing(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">OpenCompress Studio V2.1</p>
          <h1>Shop image optimizer with local compression, Auto Best and optional reSmush.it.</h1>
          <p className="hero-copy">
            Compress, resize, rename and convert product images locally. Use external reSmush.it only when you explicitly choose it.
          </p>
        </div>
        <div className="hero-stats">
          <span>{files.length} files</span>
          <strong>{formatBytes(totalInput)}</strong>
        </div>
      </header>

      <section className="grid-layout">
        <aside className="panel controls-panel">
          <div className="panel-heading">
            <h2>1. Upload</h2>
            <button className="ghost-button" onClick={clearFiles} disabled={!files.length || isProcessing}>Clear</button>
          </div>

          <div
            className="drop-zone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
          >
            <strong>Drop images here</strong>
            <span>JPG, PNG, WebP, GIF, TIF or BMP · up to {MAX_FILES} files</span>
            <input ref={fileInputRef} hidden multiple type="file" accept="image/*,.tif,.tiff,.bmp" onChange={handleInputChange} />
          </div>

          <div className="panel-heading compact"><h2>2. Compression</h2></div>

          <label className="field">
            <span>Preset</span>
            <select onChange={(event) => updateSettings(presetSettings[event.target.value] || {})} defaultValue="">
              <option value="">Custom</option>
              <option value="WooCommerce">WooCommerce Product WebP</option>
              <option value="Amazon">Amazon Main Image JPG</option>
              <option value="Etsy">Etsy Listing Image</option>
              <option value="Instagram">Instagram Post</option>
              <option value="TransparentPNG">Transparent PNG</option>
              <option value="SmallWeb">Small Web Thumbnail</option>
            </select>
          </label>

          <label className="field">
            <span>Compression method</span>
            <select value={settings.mode} onChange={(event) => updateSettings({ mode: event.target.value as CompressionMode })}>
              <option value="local">Local only</option>
              <option value="best">Auto Best local</option>
              <option value="resmush">reSmush.it API</option>
              <option value="auto">Auto compare local vs reSmush.it</option>
            </select>
          </label>

          {settings.mode !== 'local' && settings.mode !== 'best' && (
            <div className="privacy-note">
              reSmush.it uploads selected images to an external API. Use Local only or Auto Best local for confidential images.
            </div>
          )}

          {settings.mode === 'auto' && (
            <label className="check-field">
              <input type="checkbox" checked={settings.fairCompare} onChange={(event) => updateSettings({ fairCompare: event.target.checked })} />
              <span>Fair Compare: same format, no resize, same quality</span>
            </label>
          )}

          <label className="field">
            <span>Output format</span>
            <select value={settings.format} onChange={(event) => updateSettings({ format: event.target.value as OutputFormat })} disabled={settings.mode === 'best'}>
              <option value="webp">WebP</option>
              <option value="jpeg">JPG</option>
              <option value="png">PNG</option>
              <option value="original">Keep original where possible</option>
            </select>
          </label>

          <label className="field range-field">
            <span>Local quality: {settings.quality}</span>
            <input type="range" min="1" max="100" value={settings.quality} onChange={(event) => updateSettings({ quality: Number(event.target.value) })} />
          </label>

          {settings.mode !== 'local' && settings.mode !== 'best' && (
            <label className="field range-field">
              <span>reSmush.it quality: {settings.resmushQuality}</span>
              <input type="range" min="0" max="100" value={settings.resmushQuality} onChange={(event) => updateSettings({ resmushQuality: Number(event.target.value) })} />
            </label>
          )}

          <label className="check-field">
            <input type="checkbox" checked={settings.targetSizeEnabled} onChange={(event) => updateSettings({ targetSizeEnabled: event.target.checked })} />
            <span>Target file size</span>
          </label>

          {settings.targetSizeEnabled && (
            <label className="field">
              <span>Target KB per image</span>
              <input type="number" min="10" value={settings.targetSizeKb} onChange={(event) => updateSettings({ targetSizeKb: Number(event.target.value) })} />
            </label>
          )}

          {settings.targetSizeEnabled && !targetApplies && settings.mode !== 'best' && (
            <div className="info-box">Target size works best with JPG/WebP. PNG will use normal optimization.</div>
          )}

          <label className="check-field">
            <input type="checkbox" checked={settings.resizeEnabled} onChange={(event) => updateSettings({ resizeEnabled: event.target.checked })} />
            <span>Resize images</span>
          </label>

          <div className="two-cols">
            <label className="field">
              <span>Max width</span>
              <input type="number" min="1" value={settings.maxWidth} disabled={!settings.resizeEnabled} onChange={(event) => updateSettings({ maxWidth: Number(event.target.value) })} />
            </label>
            <label className="field">
              <span>Max height</span>
              <input type="number" min="1" value={settings.maxHeight} disabled={!settings.resizeEnabled} onChange={(event) => updateSettings({ maxHeight: Number(event.target.value) })} />
            </label>
          </div>

          <label className="check-field">
            <input type="checkbox" checked={settings.keepMetadata} onChange={(event) => updateSettings({ keepMetadata: event.target.checked })} />
            <span>Keep local metadata</span>
          </label>

          {settings.mode !== 'local' && settings.mode !== 'best' && (
            <label className="check-field">
              <input type="checkbox" checked={settings.keepExif} onChange={(event) => updateSettings({ keepExif: event.target.checked })} />
              <span>Keep EXIF for reSmush.it</span>
            </label>
          )}

          {settings.format === 'jpeg' && (
            <label className="field">
              <span>JPG background for transparency</span>
              <input type="color" value={settings.background} onChange={(event) => updateSettings({ background: event.target.value })} />
            </label>
          )}

          {transparencyRisk && <div className="warning-box">Some selected files may contain transparency. JPG output will flatten transparent areas.</div>}

          <div className="panel-heading compact"><h2>3. Rename</h2></div>

          <label className="check-field">
            <input type="checkbox" checked={settings.renameEnabled} onChange={(event) => updateSettings({ renameEnabled: event.target.checked })} />
            <span>SEO batch rename</span>
          </label>

          {settings.renameEnabled && (
            <>
              <label className="field">
                <span>Base name</span>
                <input value={settings.renameBase} onChange={(event) => updateSettings({ renameBase: event.target.value })} placeholder="anime-mug-design" />
              </label>
              <div className="two-cols">
                <label className="field">
                  <span>Start number</span>
                  <input type="number" min="0" value={settings.renameStart} onChange={(event) => updateSettings({ renameStart: Number(event.target.value) })} />
                </label>
                <label className="field">
                  <span>Padding</span>
                  <input type="number" min="1" max="8" value={settings.renamePad} onChange={(event) => updateSettings({ renamePad: Number(event.target.value) })} />
                </label>
              </div>
            </>
          )}

          <label className="check-field">
            <input type="checkbox" checked={settings.keepOriginalIfLarger} onChange={(event) => updateSettings({ keepOriginalIfLarger: event.target.checked })} />
            <span>Keep original if result is larger</span>
          </label>

          <button className="primary-button" onClick={processImages} disabled={isProcessing || !files.length}>
            {isProcessing ? 'Compressing...' : 'Compress images'}
          </button>
          {isProcessing && <button className="danger-button" onClick={cancelProcessing}>Cancel batch</button>}

          {error && <div className="error-box">{error}</div>}
        </aside>

        <section className="panel workspace-panel">
          <div className="panel-heading">
            <h2>Files</h2>
            <span className="muted">{files.length ? `${files.length} selected` : 'No files yet'}</span>
          </div>

          {!files.length ? (
            <div className="empty-state">Upload images to start a new compression batch.</div>
          ) : (
            <div className="file-strip">
              {files.map((item, index) => (
                <button key={item.id} className={`thumb ${index === activeIndex ? 'active' : ''}`} onClick={() => setActiveIndex(index)}>
                  <img src={item.originalUrl} alt={item.file.name} />
                  <span>{item.file.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="preview-grid">
            <BeforeAfterPreview
              originalUrl={activeOriginal}
              optimizedUrl={activeOptimized}
              fileName={activeResult?.originalName || files[activeIndex]?.file.name}
              originalInfo={activeResult ? `${activeResult.originalFormat?.toUpperCase() || 'Original'} · ${formatBytes(activeResult.inputSize)}` : undefined}
              optimizedInfo={activeResult ? `${activeResult.format?.toUpperCase() || 'Output'} · ${formatBytes(activeResult.outputSize)}` : undefined}
            />
            <div className="summary-card">
              <h3>Batch summary</h3>
              {job ? (
                <>
                  <div className="summary-row"><span>Original</span><strong>{formatBytes(job.totals.totalOriginal)}</strong></div>
                  <div className="summary-row"><span>Optimized</span><strong>{formatBytes(job.totals.totalOutput)}</strong></div>
                  <div className={`summary-row highlight ${job.totals.savedBytes < 0 ? 'negative' : ''}`}><span>Saved</span><strong>{formatBytes(job.totals.savedBytes)} ({formatSavings(job.totals.savedPercent)})</strong></div>
                  <div className="summary-row"><span>Successful</span><strong>{optimizedCount}</strong></div>
                  <div className="summary-row"><span>Warnings</span><strong>{warningCount}</strong></div>
                  <div className="summary-row"><span>Failed</span><strong>{failedCount}</strong></div>
                  {job.downloadUrl && <a className="download-button" href={job.downloadUrl}>Download ZIP</a>}
                </>
              ) : (
                <p className="muted">Run compression to see file savings and download your ZIP.</p>
              )}
            </div>
          </div>

          {activeResult?.candidates?.length ? (
            <div className="candidate-card">
              <h3>Candidate comparison</h3>
              <div className="candidate-list">
                {activeResult.candidates.map((candidate) => (
                  <div key={`${candidate.method}-${candidate.size || candidate.error}`} className="candidate-pill">
                    <strong>{candidate.method}</strong>
                    {candidate.error ? <span>{candidate.error}</span> : <span>{candidate.format?.toUpperCase()} · {formatBytes(candidate.size || 0)} · Q{candidate.quality ?? '-'}</span>}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {job && (
            <div className="results-table-wrap">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Method</th>
                    <th>Format</th>
                    <th>Dimensions</th>
                    <th>Before</th>
                    <th>After</th>
                    <th>Saved</th>
                    <th>Quality</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {job.results.map((item, index) => (
                    <tr key={`${item.originalName}-${index}`} onClick={() => setActiveIndex(index)} className={index === activeIndex ? 'active-row' : ''}>
                      <td>
                        <strong>{item.originalName}</strong>
                        {item.outputName && <small>→ {item.outputName}</small>}
                        {item.message && <small>{item.message}</small>}
                        {item.warnings?.map((warning) => <small className="warning-text" key={warning}>{warning}</small>)}
                      </td>
                      <td>{item.method}</td>
                      <td>{item.originalFormat || '-'} → {item.format || '-'}</td>
                      <td>{dimensionText(item.inputWidth, item.inputHeight)} → {dimensionText(item.width, item.height)}</td>
                      <td>{formatBytes(item.inputSize)}</td>
                      <td>{formatBytes(item.outputSize)}</td>
                      <td className={item.savedBytes < 0 ? 'negative-text' : 'positive-text'}>{formatSavings(item.savedPercent)}</td>
                      <td>{item.quality ?? '-'}</td>
                      <td><span className={`status ${item.status}`}>{item.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function dimensionText(width?: number | null, height?: number | null): string {
  return width && height ? `${width}×${height}` : '-';
}
