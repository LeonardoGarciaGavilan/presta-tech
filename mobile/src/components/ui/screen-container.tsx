import { View, ViewStyle, StyleProp } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/components/ui/theme-provider';

type ScreenContainerProps = {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export function ScreenContainer({ style, children }: ScreenContainerProps) {
  const { colorScheme, colors } = useTheme();
  return (
    <SafeAreaView edges={['left', 'right']} style={[{ flex: 1, backgroundColor: colors.background }, style]}>
      {children}
    </SafeAreaView>
  );
}
