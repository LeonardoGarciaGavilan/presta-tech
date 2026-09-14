import { createContext, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Colors, type ThemeColors } from '@/constants/theme';
import { ThemeMode, useThemeStore } from '@/store/theme.store';

export type ColorTone = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'route' | 'teal';

const SOLID_LIGHT: Record<ColorTone, keyof ThemeColors> = {
  primary: 'primary',
  secondary: 'secondaryDark',
  success: 'successDark',
  warning: 'warningDark',
  error: 'error',
  info: 'infoDark',
  route: 'routeDark',
  teal: 'teal',
};

const SOLID_DARK: Record<ColorTone, keyof ThemeColors> = {
  primary: 'primaryLight',
  secondary: 'secondaryLight',
  success: 'successLight',
  warning: 'warningLight',
  error: 'errorLight',
  info: 'infoLight',
  route: 'routeBg',
  teal: 'tealLight',
};

/**
 * Background color para rellenos sólidos que llevan contenido blanco encima
 * (botones filled, headers de modales, FABs, chips seleccionados).
 * Garantiza ratio AA en ambos esquemas: en light usa tonos profundos,
 * en dark usa los tintes oscuros (toggle invertido).
 */
export function getSolidFill(
  colors: ThemeColors,
  colorScheme: 'light' | 'dark',
  tone: ColorTone,
): string {
  return colors[colorScheme === 'dark' ? SOLID_DARK[tone] : SOLID_LIGHT[tone]];
}

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
    themeMode === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : themeMode;

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
