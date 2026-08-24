import { useState } from 'react';
import { THEMES, type ThemeId, getSavedTheme, setTheme } from '../lib/themes';

export default function ThemeSwitcher({ onThemeChange }: { onThemeChange?: (id: ThemeId) => void }) {
  const [current, setCurrent] = useState<ThemeId>(getSavedTheme);

  const pick = (id: ThemeId) => {
    setCurrent(id);
    setTheme(id);
    onThemeChange?.(id);
  };

  return (
    <div className="theme-switcher">
      <span className="theme-switcher-label">TEMA</span>
      <div className="theme-swatches">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`theme-swatch${current === t.id ? ' active' : ''}`}
            title={t.label}
            onClick={() => pick(t.id)}
          >
            <span className="theme-swatch-bg" style={{ background: t.bg }} />
            <span className="theme-swatch-dot" style={{ background: t.swatch }} />
          </button>
        ))}
      </div>
    </div>
  );
}
