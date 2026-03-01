import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface Settings {
  showMiraHints: boolean;
  theme: ThemeMode;
  compactMode: boolean;
}

interface SettingsContextType extends Settings {
  setShowMiraHints: (v: boolean) => void;
  setTheme: (v: ThemeMode) => void;
  setCompactMode: (v: boolean) => void;
}

const STORAGE_KEY = 'mira-settings';

const defaults: Settings = {
  showMiraHints: true,
  theme: 'light',
  compactMode: false,
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return { ...defaults };
}

function saveSettings(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    // system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  }
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    applyTheme(settings.theme);
    saveSettings(settings);
    document.documentElement.classList.toggle('compact', settings.compactMode);
  }, [settings]);

  // Listen for system theme changes
  useEffect(() => {
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.theme]);

  return (
    <SettingsContext.Provider value={{
      ...settings,
      setShowMiraHints: (v) => setSettings(p => ({ ...p, showMiraHints: v })),
      setTheme: (v) => setSettings(p => ({ ...p, theme: v })),
      setCompactMode: (v) => setSettings(p => ({ ...p, compactMode: v })),
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
