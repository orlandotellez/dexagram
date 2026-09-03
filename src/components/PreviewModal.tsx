import { useEffect } from 'react';

interface PreviewModalProps {
  title: string;
  html: string;
  onClose: () => void;
}

export default function PreviewModal({ title, html, onClose }: PreviewModalProps) {
  useEffect(() => {
    if (!html) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [html, onClose]);

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div
        className="preview-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Vista previa del diagrama"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="preview-header">
          <span className="preview-eyebrow">VISTA PREVIA</span>
          <button
            type="button"
            className="icon-btn"
            title="Cerrar vista previa"
            aria-label="Cerrar vista previa"
            onClick={onClose}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </header>
        <div className="preview-frame">
          <iframe title={`Vista previa — ${title || 'diagrama'}`} srcDoc={html} />
        </div>
      </div>
    </div>
  );
}
