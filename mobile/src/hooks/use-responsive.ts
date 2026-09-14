import { useWindowDimensions } from 'react-native';

interface ResponsiveBreakpoints {
  xs?: number;
  sm?: number;
  md?: number;
}

interface UseResponsiveColumnsOptions {
  breakpoints?: ResponsiveBreakpoints;
}

function getColumns(width: number, breakpoints: Required<ResponsiveBreakpoints>): number {
  if (width < breakpoints.xs) return 1;
  if (width < breakpoints.sm) return 2;
  if (width < breakpoints.md) return 3;
  return 4;
}

export function useResponsiveColumns(options?: UseResponsiveColumnsOptions) {
  const { width } = useWindowDimensions();

  const breakpoints: Required<ResponsiveBreakpoints> = {
    xs: 400,
    sm: 600,
    md: 900,
    ...options?.breakpoints,
  };

  const columns = getColumns(width, breakpoints);

  return { columns, width };
}