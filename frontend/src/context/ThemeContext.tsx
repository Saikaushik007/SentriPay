import { createContext, useContext, useState } from 'react';

export type LightThemeId = 'aurora' | 'emerald' | 'sunset' | 'ocean';

export interface ThemeConfig {
  id: LightThemeId;
  name: string;
  badgeBg: string;
  badgeBorder: string;
  primary: string;
  primaryLight: string;
  accent: string;
  pageGradient: string;
}

export const LIGHT_THEMES: Record<LightThemeId, ThemeConfig> = {
  aurora: {
    id: 'aurora',
    name: 'Aurora Lavender',
    badgeBg: '#F5F3FF',
    badgeBorder: '#DDD6FE',
    primary: '#4F46E5',
    primaryLight: '#EEF2FF',
    accent: '#7C3AED',
    pageGradient: 'linear-gradient(135deg, #F5F3FF 0%, #F0F9FF 33%, #F0FDF4 66%, #FFF7ED 100%)'
  },
  emerald: {
    id: 'emerald',
    name: 'Mint Emerald',
    badgeBg: '#ECFDF5',
    badgeBorder: '#A7F3D0',
    primary: '#059669',
    primaryLight: '#DCFCE7',
    accent: '#10B981',
    pageGradient: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 40%, #EFF6FF 80%, #F8FAFC 100%)'
  },
  sunset: {
    id: 'sunset',
    name: 'Peach Sunset',
    badgeBg: '#FFF7ED',
    badgeBorder: '#FED7AA',
    primary: '#EA580C',
    primaryLight: '#FFEDD5',
    accent: '#F97316',
    pageGradient: 'linear-gradient(135deg, #FFF7ED 0%, #FFF1F2 40%, #FEF3C7 80%, #FFFFFF 100%)'
  },
  ocean: {
    id: 'ocean',
    name: 'Sky Ocean',
    badgeBg: '#F0F9FF',
    badgeBorder: '#BAE6FD',
    primary: '#0284C7',
    primaryLight: '#E0F2FE',
    accent: '#0EA5E9',
    pageGradient: 'linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 40%, #EEF2FF 80%, #FFFFFF 100%)'
  }
};

interface ThemeContextType {
  currentTheme: ThemeConfig;
  setTheme: (id: LightThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  currentTheme: LIGHT_THEMES.aurora,
  setTheme: () => {}
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<LightThemeId>(() => {
    return (localStorage.getItem('sentripay_theme_id') as LightThemeId) || 'aurora';
  });

  const setTheme = (id: LightThemeId) => {
    setThemeId(id);
    localStorage.setItem('sentripay_theme_id', id);
  };

  const currentTheme = LIGHT_THEMES[themeId] || LIGHT_THEMES.aurora;

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
