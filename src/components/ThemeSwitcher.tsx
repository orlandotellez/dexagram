import { useEffect, useMemo, useRef, useState } from 'react';
import { THEMES, type ThemeId, getSavedTheme, setTheme } from '../lib/themes';

function isLight(bg: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(bg);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

interface PreviewTokens {
  bg: string;
  accent: string;
  card: string;
  cardBorder: string;
  title: string;
  line: string;
}

function previewTokens(bg: string, accent: string): PreviewTokens {
  const light = isLight(bg);
  return {
    bg,
    accent,
    card: light ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.1)',
    cardBorder: light ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.45)',
    title: light ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.9)',
    line: light ? 'rgba(0, 0, 0, 0.28)' : 'rgba(255, 255, 255, 0.3)',
  };
}

export default function ThemeSwitcher() {
  const [current, setCurrent] = useState<ThemeId>(getSavedTheme);
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const tokensByTheme = useMemo(() => {
    const map = new Map<ThemeId, PreviewTokens>();
    for (const t of THEMES) map.set(t.id, previewTokens(t.bg, t.swatch));
    return map;
  }, []);

  const currentMeta = THEMES.find((t) => t.id === current) ?? THEMES[0];
  const lightThemes = THEMES.filter((t) => isLight(t.bg));
  const darkThemes = THEMES.filter((t) => !isLight(t.bg));

  const pick = (id: ThemeId) => {
    setCurrent(id);
    setTheme(id);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const toggle = () => {
    const next = !open;
    if (next && rootRef.current) {
      const r = rootRef.current.getBoundingClientRect();
      setDropUp(window.innerHeight - r.bottom < 340 && r.top > window.innerHeight - r.bottom);
    }
    setOpen(next);
  };

  const cur = tokensByTheme.get(current)!;

  return (
    <div className="theme-switcher" ref={rootRef}>
      <button
        type="button"
        className="theme-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`Tema actual: ${currentMeta.label}`}
        onClick={toggle}
      >
        <span className="theme-picker-dot" style={{ background: cur.bg, borderColor: cur.cardBorder }}>
          <span className="theme-picker-dot-inner" style={{ background: cur.accent }} />
        </span>
        <span className="theme-picker-trigger-name">{currentMeta.label}</span>
        <svg
          className={`theme-picker-chevron${open ? ' open' : ''}`}
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        >
          <path d="M1.8 3.6 5 6.8l3.2-3.2" />
        </svg>
      </button>

      {open && (
        <>
          <div className="theme-popover-backdrop" onClick={() => setOpen(false)} />
          <div className={`theme-popover${dropUp ? ' theme-popover-up' : ''}`} role="listbox" aria-label="Elegir tema">
            {[
              { title: 'Claros', themes: lightThemes },
              { title: 'Oscuros', themes: darkThemes },
            ].map((group) =>
              group.themes.length > 0 ? (
                <div key={group.title}>
                  <div className="theme-group-label">{group.title}</div>
                  {group.themes.map((t) => {
                    const tk = tokensByTheme.get(t.id)!;
                    const active = current === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`theme-option${active ? ' active' : ''}`}
                        onClick={() => pick(t.id)}
                      >
                        <span className="theme-option-preview" style={{ background: tk.bg }}>
                          <span
                            className="theme-option-card"
                            style={{ background: tk.card, borderColor: tk.cardBorder }}
                          >
                            <span className="theme-option-bar theme-option-bar-title" style={{ background: tk.title }} />
                            <span className="theme-option-bar" style={{ background: tk.line }} />
                            <span className="theme-option-keyrow">
                              <span className="theme-option-key" style={{ background: tk.accent }} />
                              <span className="theme-option-bar theme-option-bar-rest" style={{ background: tk.line }} />
                            </span>
                          </span>
                        </span>
                        <span className="theme-option-label">{t.label}</span>
                        {active && (
                          <svg
                            className="theme-option-check"
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          >
                            <path d="M2 6.5l2.5 2.5L10 3.5" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : null,
            )}
          </div>
        </>
      )}
    </div>
  );
}
