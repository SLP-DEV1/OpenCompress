import { CSSProperties, useMemo, useState } from 'react';

type Props = {
  originalUrl: string | null;
  optimizedUrl: string | null;
  fileName?: string;
  originalInfo?: string;
  optimizedInfo?: string;
};

export default function BeforeAfterPreview({ originalUrl, optimizedUrl, fileName, originalInfo, optimizedInfo }: Props) {
  const [split, setSplit] = useState(50);
  const [zoom, setZoom] = useState(1);
  const label = useMemo(() => fileName || 'Preview', [fileName]);

  if (!originalUrl || !optimizedUrl) {
    return (
      <div className="preview-empty">
        <span>Preview appears after compression.</span>
      </div>
    );
  }

  const imageStyle: CSSProperties = zoom > 1 ? { transform: `scale(${zoom})` } : {};

  return (
    <div className="before-after-card">
      <div className="preview-title-row">
        <div>
          <div className="preview-title">{label}</div>
          <div className="preview-meta">{originalInfo || 'Original'} → {optimizedInfo || 'Optimized'}</div>
        </div>
        <select value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Preview zoom">
          <option value={1}>Fit</option>
          <option value={1.5}>150%</option>
          <option value={2}>200%</option>
        </select>
      </div>
      <div className="before-after" style={{ '--split': `${split}%` } as CSSProperties}>
        <img src={optimizedUrl} alt="Optimized preview" className="after-img" style={imageStyle} />
        <div className="before-layer">
          <img src={originalUrl} alt="Original preview" style={imageStyle} />
        </div>
        <div className="split-line" />
        <span className="preview-pill left">Before</span>
        <span className="preview-pill right">After</span>
      </div>
      <input
        className="split-slider"
        type="range"
        min="0"
        max="100"
        value={split}
        onChange={(event) => setSplit(Number(event.target.value))}
        aria-label="Before after comparison slider"
      />
    </div>
  );
}
