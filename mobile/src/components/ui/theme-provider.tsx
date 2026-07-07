import { createContext, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '@/constants/theme';
import { ThemeMode, useThemeStore } from '@/store/theme.store';

interface ThemeContextValue {
  colorScheme: 'light' | 'dark';
  colors: (typeof Colors)['light'];
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { themeMode, setThemeMode, hydrate } = useThemeStore();
  const systemScheme = useColorScheme();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const effectiveColorScheme =
    themeMode === 'system' ? (systemScheme ?? 'light') : themeMode;

  const colors = Colors[effectiveColorScheme];

  return (
    <ThemeContext.Provider
      value={{
        colorScheme: effectiveColorScheme,
        colors,
        themeMode,
        setThemeMode,
      }}
    >
      {children}
      <StatusBar style={effectiveColorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
