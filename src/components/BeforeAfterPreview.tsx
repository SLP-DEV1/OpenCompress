import { useMemo, useState } from 'react';

type Props = {
  originalUrl: string | null;
  optimizedUrl: string | null;
  fileName?: string;
};

export default function BeforeAfterPreview({ originalUrl, optimizedUrl, fileName }: Props) {
  const [split, setSplit] = useState(50);
  const label = useMemo(() => fileName || 'Preview', [fileName]);

  if (!originalUrl || !optimizedUrl) {
    return (
      <div className="preview-empty">
        <span>Preview appears after compression.</span>
      </div>
    );
  }

  return (
    <div className="before-after-card">
      <div className="preview-title">{label}</div>
      <div className="before-after" style={{ '--split': `${split}%` } as React.CSSProperties}>
        <img src={optimizedUrl} alt="Optimized preview" className="after-img" />
        <div className="before-layer">
          <img src={originalUrl} alt="Original preview" />
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
