import { ChangeEvent, DragEvent, useMemo, useRef, useState } from 'react';
import BeforeAfterPreview from './components/BeforeAfterPreview';
import { formatBytes, formatSavings, supportedFile } from './lib/format';

type CompressionMode = 'local' | 'resmush' | 'auto';
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
};

type ResultItem = {
  originalName: string;
  outputName?: string;
  previewUrl?: string;
  inputSize: number;
  outputSize: number;
  savedBytes: number;
  savedPercent: number;
  width?: number | null;
  height?: number | null;
  format?: string;
  method: string;
  status: string;
  message?: string;
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

const defaultSettings: Settings = {
  mode: 'local',
  format: 'webp',
  quality: 82,
  resizeEnabled: true,
  maxWidth: 1600,
  maxHeight: 1600,
  keepMetadata: false,
  keepExif: false,
  resmushQuality: 92
};

const presetSettings: Record<string, Partial<Settings>> = {
  WooCommerce: { format: 'webp', quality: 82, resizeEnabled: true, maxWidth: 1600, maxHeight: 1600, keepMetadata: false },
  Amazon: { format: 'jpeg', quality: 88, resizeEnabled: true, maxWidth: 2000, maxHeight: 2000, keepMetadata: false },
  Etsy: { format: 'jpeg', quality: 86, resizeEnabled: true, maxWidth: 2000, maxHeight: 2000, keepMetadata: false },
  Instagram: { format: 'jpeg', quality: 85, resizeEnabled: true, maxWidth: 1080, maxHeight: 1350, keepMetadata: false },
  TransparentPNG: { format: 'png', quality: 90, resizeEnabled: false, keepMetadata: false }
};

export default function App() {
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isProcessing, setIsProcessing] = useState(false);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeResult = job?.results[activeIndex] || null;
  const activeOriginal = files.find((item) => item.file.name === activeResult?.originalName)?.originalUrl || files[activeIndex]?.originalUrl || null;
  const activeOptimized = activeResult?.previewUrl || null;
  const failedCount = job?.results.filter((item) => item.status === 'failed').length || 0;
  const optimizedCount = job?.results.filter((item) => item.status !== 'failed').length || 0;

  const totalInput = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files]);

  function updateSettings(patch: Partial<Settings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function addFiles(selectedFiles: FileList | File[]) {
    const incoming = Array.from(selectedFiles).filter(supportedFile);
    if (!incoming.length) {
      setError('Please select JPG, PNG, WebP, GIF, TIF or BMP images.');
      return;
    }
    setError(null);
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

  async function processImages() {
    if (!files.length) {
      setError('Upload at least one image first.');
      return;
    }
    setIsProcessing(true);
    setError(null);
    setJob(null);
    setActiveIndex(0);

    try {
      const formData = new FormData();
      for (const item of files) formData.append('images', item.file, item.file.name);
      formData.append('settings', JSON.stringify(settings));

      const response = await fetch('/api/jobs', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Compression failed.');
      setJob(data as JobResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Compression failed.');
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">OpenCompress Studio V2</p>
          <h1>Local batch image compressor with optional reSmush.it mode.</h1>
          <p className="hero-copy">
            Compress, resize and convert product images locally. Use reSmush.it only when you explicitly want external compression.
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
            role="button"
            tabIndex={0}
          >
            <strong>Drop images here</strong>
            <span>JPG, PNG, WebP, GIF, TIF or BMP</span>
            <input ref={fileInputRef} hidden multiple type="file" accept="image/*,.tif,.tiff,.bmp" onChange={handleInputChange} />
          </div>

          <div className="panel-heading compact">
            <h2>2. Settings</h2>
          </div>

          <label className="field">
            <span>Preset</span>
            <select onChange={(event) => updateSettings(presetSettings[event.target.value] || {})} defaultValue="">
              <option value="">Custom</option>
              <option value="WooCommerce">WooCommerce Product Image</option>
              <option value="Amazon">Amazon Listing Image</option>
              <option value="Etsy">Etsy Listing Image</option>
              <option value="Instagram">Instagram Post</option>
              <option value="TransparentPNG">Transparent PNG</option>
            </select>
          </label>

          <label className="field">
            <span>Compression method</span>
            <select value={settings.mode} onChange={(event) => updateSettings({ mode: event.target.value as CompressionMode })}>
              <option value="local">Local only</option>
              <option value="resmush">reSmush.it API</option>
              <option value="auto">Auto: use smaller result</option>
            </select>
          </label>

          {settings.mode !== 'local' && (
            <div className="privacy-note">
              reSmush.it mode uploads selected images to an external API. Use Local only mode for confidential images. reSmush.it supports files under 5 MB.
            </div>
          )}

          <label className="field">
            <span>Output format</span>
            <select value={settings.format} onChange={(event) => updateSettings({ format: event.target.value as OutputFormat })}>
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

          {settings.mode !== 'local' && (
            <label className="field range-field">
              <span>reSmush.it quality: {settings.resmushQuality}</span>
              <input type="range" min="0" max="100" value={settings.resmushQuality} onChange={(event) => updateSettings({ resmushQuality: Number(event.target.value) })} />
            </label>
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

          {settings.mode !== 'local' && (
            <label className="check-field">
              <input type="checkbox" checked={settings.keepExif} onChange={(event) => updateSettings({ keepExif: event.target.checked })} />
              <span>Keep EXIF for reSmush.it</span>
            </label>
          )}

          <button className="primary-button" onClick={processImages} disabled={isProcessing || !files.length}>
            {isProcessing ? 'Compressing...' : 'Compress images'}
          </button>

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
            <BeforeAfterPreview originalUrl={activeOriginal} optimizedUrl={activeOptimized} fileName={activeResult?.originalName || files[activeIndex]?.file.name} />
            <div className="summary-card">
              <h3>Batch summary</h3>
              {job ? (
                <>
                  <div className="summary-row"><span>Original</span><strong>{formatBytes(job.totals.totalOriginal)}</strong></div>
                  <div className="summary-row"><span>Optimized</span><strong>{formatBytes(job.totals.totalOutput)}</strong></div>
                  <div className="summary-row highlight"><span>Saved</span><strong>{formatBytes(job.totals.savedBytes)} ({formatSavings(job.totals.savedPercent)})</strong></div>
                  <div className="summary-row"><span>Successful</span><strong>{optimizedCount}</strong></div>
                  <div className="summary-row"><span>Failed</span><strong>{failedCount}</strong></div>
                  {job.downloadUrl && <a className="download-button" href={job.downloadUrl}>Download ZIP</a>}
                </>
              ) : (
                <p className="muted">Run compression to see file savings and download your ZIP.</p>
              )}
            </div>
          </div>

          {job && (
            <div className="results-table-wrap">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Method</th>
                    <th>Before</th>
                    <th>After</th>
                    <th>Saved</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {job.results.map((item, index) => (
                    <tr key={`${item.originalName}-${index}`} onClick={() => setActiveIndex(index)} className={index === activeIndex ? 'active-row' : ''}>
                      <td>
                        <strong>{item.originalName}</strong>
                        {item.message && <small>{item.message}</small>}
                      </td>
                      <td>{item.method}</td>
                      <td>{formatBytes(item.inputSize)}</td>
                      <td>{formatBytes(item.outputSize)}</td>
                      <td>{formatSavings(item.savedPercent)}</td>
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
