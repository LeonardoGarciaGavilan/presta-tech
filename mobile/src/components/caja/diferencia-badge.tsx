import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppStyles, BorderRadius, FontSize, FontWeight, Spacing, scale } from '@/constants/theme';
import { formatCurrency } from '@/utils/formatters';
import { useTheme } from '@/components/ui/theme-provider';

interface Props {
  monto: number;
  esperado: number;
}

export default function DiferenciaBadge({ monto, esperado }: Props) {
  const { colors } = useTheme();
  const dif = monto - esperado;
  const cuadrada = dif === 0;

  const color = cuadrada ? colors.success : colors.error;
  const bg = cuadrada ? colors.successLight : colors.errorLight;
  const icon = cuadrada ? ('checkmark-circle' as const) : ('alert-circle' as const);
  const label = cuadrada
    ? 'Cuadrada'
    : `${dif > 0 ? 'Sobrante' : 'Faltante'}: ${formatCurrency(Math.abs(dif))}`;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={scale(16)} color={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = {
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  } as AppStyles,
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
} as const;
