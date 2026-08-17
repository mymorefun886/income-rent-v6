// Theme store for dark mode
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      toggle: () => {
        const current = get().theme;
        const next = current === 'light' ? 'dark' : current === 'dark' ? 'light' : 'dark';
        set({ theme: next });
        applyTheme(next);
      },
    }),
    {
      name: 'theme-storage',
    }
  )
);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (theme === 'dark' || (theme === 'system' && systemDark)) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

// Initialize theme on load
export function initTheme() {
  const stored = localStorage.getItem('theme-storage');
  let theme: Theme = 'system';

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      theme = parsed.state?.theme || 'system';
    } catch {
      // ignore
    }
  }

  applyTheme(theme);

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const current = useThemeStore.getState().theme;
    if (current === 'system') {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  });
}
