import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, FontWeight, Spacing, scale} from '@/constants/theme';
import { formatCurrency } from '@/utils/formatters';
import type { Cliente, Prestamo } from '@/types/cliente.types';
import { useTheme } from '@/components/ui/theme-provider';

interface ClienteQuickActionsProps {
  cliente: Cliente;
  prestamo?: Prestamo | null;
  onRegistrarPago?: () => void;
  onVerPrestamo?: () => void;
}

function normalizarCelular(num: string | null): string | null {
  if (!num) return null;
  const d = String(num).replace(/[^\d+]/g, '');
  const digits = d.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return d;
}

export default function ClienteQuickActions({
  cliente,
  prestamo,
  onRegistrarPago,
  onVerPrestamo,
}: ClienteQuickActionsProps) {
  const { colors } = useTheme();
  const celular = normalizarCelular(cliente.celular);
  const hayPrestamo = !!prestamo;

  const handleWhatsApp = () => {
    if (!celular) return;
    const d = celular.replace(/\D/g, '');
    const number = !celular.startsWith('+') && d.length === 10 ? '1' + d : d;
    Linking.openURL(`https://wa.me/${number}`);
  };

  const handleCall = () => {
    if (!celular) return;
    Linking.openURL(`tel:${celular}`);
  };

  return (
    <View style={styles.grid}>
      <Pressable
        onPress={hayPrestamo ? onRegistrarPago : undefined}
        disabled={!hayPrestamo}
        accessibilityRole="button"
        accessibilityLabel={hayPrestamo ? `Registrar pago de ${formatCurrency(prestamo!.cuotaMensual)}` : 'No hay préstamo activo'}
        style={({ pressed }) => [
          styles.action,
          {
            backgroundColor: hayPrestamo ? colors.primaryLight : colors.disabledBackground,
            borderColor: hayPrestamo ? colors.primary : colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Ionicons
          name="cash"
          size={scale(22)}
          color={hayPrestamo ? colors.primary : colors.disabled}
        />
        <Text
          style={[
            styles.actionLabel,
            { color: hayPrestamo ? colors.primary : colors.disabled },
          ]}
          numberOfLines={1}
        >
          Pago
        </Text>
        {hayPrestamo && (
          <Text style={[styles.actionSub, { color: colors.primary }]} numberOfLines={1}>
            {formatCurrency(prestamo!.cuotaMensual)}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={celular ? handleWhatsApp : undefined}
        disabled={!celular}
        accessibilityRole="button"
        accessibilityLabel={celular ? `Enviar WhatsApp a ${celular}` : 'Sin número de celular'}
        style={({ pressed }) => [
          styles.action,
          {
            backgroundColor: celular ? colors.successLight : colors.disabledBackground,
            borderColor: celular ? colors.success : colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Ionicons
          name="logo-whatsapp"
          size={scale(22)}
          color={celular ? colors.whatsapp : colors.disabled}
        />
        <Text
          style={[
            styles.actionLabel,
            { color: celular ? colors.success : colors.disabled },
          ]}
          numberOfLines={1}
        >
          WhatsApp
        </Text>
      </Pressable>

      <Pressable
        onPress={celular ? handleCall : undefined}
        disabled={!celular}
        accessibilityRole="button"
        accessibilityLabel={celular ? `Llamar a ${celular}` : 'Sin número de teléfono'}
        style={({ pressed }) => [
          styles.action,
          {
            backgroundColor: celular ? colors.infoLight : colors.disabledBackground,
            borderColor: celular ? colors.info : colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Ionicons
          name="call"
          size={scale(22)}
          color={celular ? colors.phone : colors.disabled}
        />
        <Text
          style={[
            styles.actionLabel,
            { color: celular ? colors.phone : colors.disabled },
          ]}
          numberOfLines={1}
        >
          Llamar
        </Text>
      </Pressable>

      <Pressable
        onPress={hayPrestamo ? onVerPrestamo : undefined}
        disabled={!hayPrestamo}
        accessibilityRole="button"
        accessibilityLabel={hayPrestamo ? 'Ver préstamo' : 'No hay préstamo activo'}
        style={({ pressed }) => [
          styles.action,
          {
            backgroundColor: hayPrestamo ? colors.infoLight : colors.disabledBackground,
            borderColor: hayPrestamo ? colors.info : colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Ionicons
          name="eye"
          size={scale(22)}
          color={hayPrestamo ? colors.info : colors.disabled}
        />
        <Text
          style={[
            styles.actionLabel,
            { color: hayPrestamo ? colors.info : colors.disabled },
          ]}
          numberOfLines={1}
        >
          Préstamo
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  actionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: scale(4),
  },
  actionSub: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginTop: scale(1),
  },
});
