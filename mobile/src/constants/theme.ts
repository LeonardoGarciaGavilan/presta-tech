import { Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ── Responsive Scaling ──────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_WIDTH = 375; // iPhone standard design width

const widthFactor = SCREEN_WIDTH / BASE_WIDTH;
const platformFactor = Platform.OS === 'android' ? 0.87 : 1;
const combinedFactor = widthFactor * platformFactor;

/**
 * Scale a size value based on screen width and platform.
 * Use for spacing, heights, widths, border-radius, etc.
 */
export function scale(size: number): number {
  return Math.round(size * combinedFactor);
}

/**
 * Scale a font size with less aggressive growth.
 * `factor` controls how much the width-based scaling applies (0 = no scale, 1 = full scale).
 */
export function moderateScale(size: number, factor: number = 0.5): number {
  const adjusted = size * platformFactor;
  return Math.round(adjusted + (widthFactor * adjusted - adjusted) * factor);
}

// ── Colors ──────────────────────────────────────────────────────────

export const Colors = {
  light: {
    primary: '#2563EB',
    primaryLight: '#EFF6FF',
    primaryDark: '#1D4ED8',
    secondary: '#059669',
    secondaryLight: '#ECFDF5',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    surfaceElevated: '#FFFFFF',
    text: '#111827',
    textSecondary: '#6B7280',
    textTertiary: '#94A3B8',
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    error: '#DC2626',
    errorLight: '#FEF2F2',
    success: '#16A34A',
    successLight: '#F0FDF4',
    warning: '#D97706',
    warningLight: '#FFFBEB',
    info: '#0284C7',
    infoLight: '#F0F9FF',
    disabled: '#D1D5DB',
    disabledBackground: '#F3F4F6',
    overlay: 'rgba(0, 0, 0, 0.5)',
    icon: '#6B7280',
    tabIconDefault: '#9CA3AF',
    tabIconSelected: '#2563EB',
    skeleton: '#E5E7EB',
    skeletonHighlight: '#F9FAFB',
    card: '#FFFFFF',
    shadow: 'rgba(0, 0, 0, 0.08)',
    heroGradientStart: '#2563EB',
    heroGradientEnd: '#1D4ED8',
    kpiBackground: '#FFFFFF',
    badgeActive: '#16A34A',
    badgeActiveBg: '#F0FDF4',
    badgeInactive: '#94A3B8',
    badgeInactiveBg: '#F1F5F9',
    chartLine: '#2563EB',
    chartGradient: 'rgba(37, 99, 235, 0.1)',
    whatsapp: '#25D366',
    phone: '#3B82F6',
    route: '#0891B2',
    routeBg: '#ECFEFF',
  },
  dark: {
    primary: '#60A5FA',
    primaryLight: '#1E3A5F',
    primaryDark: '#93C5FD',
    secondary: '#34D399',
    secondaryLight: '#064E3B',
    background: '#0F172A',
    surface: '#1E293B',
    surfaceElevated: '#334155',
    text: '#F1F5F9',
    textSecondary: '#CBD5E1',
    textTertiary: '#64748B',
    border: '#334155',
    borderLight: '#1E293B',
    error: '#EF4444',
    errorLight: '#450A0A',
    success: '#22C55E',
    successLight: '#052E16',
    warning: '#F59E0B',
    warningLight: '#451A03',
    info: '#38BDF8',
    infoLight: '#0C4A6E',
    disabled: '#475569',
    disabledBackground: '#1E293B',
    overlay: 'rgba(0, 0, 0, 0.7)',
    icon: '#94A3B8',
    tabIconDefault: '#64748B',
    tabIconSelected: '#60A5FA',
    skeleton: '#334155',
    skeletonHighlight: '#475569',
    card: '#1E293B',
    shadow: 'rgba(0, 0, 0, 0.3)',
    heroGradientStart: '#1E3A5F',
    heroGradientEnd: '#0F172A',
    kpiBackground: '#1E293B',
    badgeActive: '#22C55E',
    badgeActiveBg: '#052E16',
    badgeInactive: '#64748B',
    badgeInactiveBg: '#1E293B',
    chartLine: '#60A5FA',
    chartGradient: 'rgba(96, 165, 250, 0.1)',
    whatsapp: '#25D366',
    phone: '#60A5FA',
    route: '#22D3EE',
    routeBg: '#164E63',
  },
};

// ── Spacing ─────────────────────────────────────────────────────────

export const Spacing = {
  xs: scale(4),
  sm: scale(8),
  md: scale(16),
  lg: scale(24),
  xl: scale(32),
  xxl: scale(48),
};

// ── Border Radius ───────────────────────────────────────────────────

export const BorderRadius = {
  sm: scale(6),
  md: scale(12),
  lg: scale(16),
  xl: scale(24),
  full: 9999,
};

// ── Font Size ───────────────────────────────────────────────────────

export const FontSize = {
  xs: moderateScale(12),
  sm: moderateScale(14),
  md: moderateScale(16),
  lg: moderateScale(18),
  xl: moderateScale(24),
  xxl: moderateScale(32),
  title: moderateScale(40),
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    android: {
      elevation: 1,
    },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    android: {
      elevation: 3,
    },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
    },
    android: {
      elevation: 6,
    },
    default: {},
  }),
};

export type IoniconsName = keyof typeof Ionicons.glyphMap;

export type AppStyles = Record<string, any>;

export function getColor(colors: typeof Colors.light, key: string): string {
  return (colors as Record<string, string>)[key] ?? colors.text;
}
