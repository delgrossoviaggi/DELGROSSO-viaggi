const THEME_KEY = 'dg_theme_preference';

export const ThemeMode = {
  LIGHT: 'light',
  DARK: 'dark'
};

export function getStoredTheme() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored === ThemeMode.DARK ? ThemeMode.DARK : stored === ThemeMode.LIGHT ? ThemeMode.LIGHT : null;
  } catch (error) {
    return null;
  }
}

export function setStoredTheme(theme) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (!theme || (theme !== ThemeMode.LIGHT && theme !== ThemeMode.DARK)) return;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
  }
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const normalized = theme === ThemeMode.DARK ? ThemeMode.DARK : ThemeMode.LIGHT;
  document.documentElement.dataset.theme = normalized;
}

export function initializeTheme() {
  const stored = getStoredTheme();
  const theme = stored || ThemeMode.LIGHT;
  applyTheme(theme);
  return theme;
}

export function toggleTheme() {
  const current = document.documentElement.dataset.theme || ThemeMode.LIGHT;
  const nextTheme = current === ThemeMode.DARK ? ThemeMode.LIGHT : ThemeMode.DARK;
  applyTheme(nextTheme);
  setStoredTheme(nextTheme);
  return nextTheme;
}

