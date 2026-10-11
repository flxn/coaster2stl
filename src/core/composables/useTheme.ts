import { reactive, readonly } from 'vue';
import type { Theme } from '../preview/PreviewStage';

const STORAGE_KEY = 'theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

const readStoredTheme = (): Theme | null => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
};

const systemTheme = (): Theme => (media.matches ? 'dark' : 'light');

/**
 * Theme shared by the header toggle and the 3D preview.
 * The initial attribute is already set by the inline script in index.html to avoid a flash.
 */
const state = reactive({
  theme: (document.documentElement.getAttribute('data-theme') as Theme | null) || readStoredTheme() || systemTheme(),
  explicit: readStoredTheme() !== null,
});

const applyTheme = (theme: Theme, animate: boolean) => {
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), 320);
  }
  root.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#12181c' : '#ffffff');
  state.theme = theme;
};

const setTheme = (theme: Theme) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage might be unavailable (private mode); the theme still applies for this session
  }
  state.explicit = true;
  applyTheme(theme, true);
};

media.addEventListener('change', () => {
  if (!state.explicit) {
    applyTheme(systemTheme(), true);
  }
});

applyTheme(state.theme, false);

export const useTheme = () => ({
  state: readonly(state),
  setTheme,
  toggleTheme: () => setTheme(state.theme === 'dark' ? 'light' : 'dark'),
});
