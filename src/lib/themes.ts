export type ThemeId = 'luna' | 'dark' | 'midnight' | 'slate' | 'emerald' | 'ocean';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  swatch: string;
  bg: string;
}

export const THEMES: ThemeMeta[] = [
  { id: 'luna', label: 'Luna', swatch: '#cb5bce', bg: '#faf7fc' },
  { id: 'dark', label: 'Dark', swatch: '#c084fc', bg: '#1a1a22' },
  { id: 'midnight', label: 'Midnight', swatch: '#818cf8', bg: '#0c0c12' },
  { id: 'slate', label: 'Slate', swatch: '#3b82f6', bg: '#f4f4f5' },
  { id: 'emerald', label: 'Emerald', swatch: '#34d399', bg: '#0c1a14' },
  { id: 'ocean', label: 'Ocean', swatch: '#38bdf8', bg: '#0c1420' },
];



export interface ThemeColors {
  paper: string;
  ink: string;
  muted: string;
  soft: string;
  accent: string;
  accentTint: string;
  hairline: string;
  hairlineSoft: string;
  nodeBg: string;
  tagBorder: string;
}


export function readThemeColors(): ThemeColors {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    paper: v('--paper'),
    ink: v('--ink'),
    muted: v('--muted'),
    soft: v('--soft'),
    accent: v('--accent'),
    accentTint: v('--accent-tint'),
    hairline: v('--hairline'),
    hairlineSoft: v('--hairline-soft'),
    nodeBg: v('--node-bg'),
    tagBorder: v('--tag-border'),
  };
}



const LS_KEY = 'diagram-web:theme';

export function getSavedTheme(): ThemeId {
  if (typeof localStorage === 'undefined') return 'luna';
  const v = localStorage.getItem(LS_KEY);
  if (v && THEMES.some((t) => t.id === v)) return v as ThemeId;
  return 'luna';
}

export function setTheme(id: ThemeId): void {
  document.documentElement.setAttribute('data-theme', id);
  try { localStorage.setItem(LS_KEY, id); } catch {  }
}


export function applySavedTheme(): void {
  const theme = getSavedTheme();
  document.documentElement.setAttribute('data-theme', theme);
}
