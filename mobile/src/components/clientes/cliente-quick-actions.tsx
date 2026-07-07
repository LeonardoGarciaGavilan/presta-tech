import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
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
  const { colorScheme, colors } = useTheme();
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
        style={({ pressed }) => [
          styles.action,
          {
            backgroundColor: hayPrestamo ? colors.primaryLight : colors.disabledBackground,
            borderColor: hayPrestamo ? colors.primary : colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons
          name="cash"
          size={22}
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
        style={({ pressed }) => [
          styles.action,
          {
            backgroundColor: celular ? '#F0FDF4' : colors.disabledBackground,
            borderColor: celular ? '#22C55E' : colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons
          name="logo-whatsapp"
          size={22}
          color={celular ? '#25D366' : colors.disabled}
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
        style={({ pressed }) => [
          styles.action,
          {
            backgroundColor: celular ? '#EFF6FF' : colors.disabledBackground,
            borderColor: celular ? '#3B82F6' : colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons
          name="call"
          size={22}
          color={celular ? '#3B82F6' : colors.disabled}
        />
        <Text
          style={[
            styles.actionLabel,
            { color: celular ? '#2563EB' : colors.disabled },
          ]}
          numberOfLines={1}
        >
          Llamar
        </Text>
      </Pressable>

      <Pressable
        onPress={hayPrestamo ? onVerPrestamo : undefined}
        disabled={!hayPrestamo}
        style={({ pressed }) => [
          styles.action,
          {
            backgroundColor: hayPrestamo ? colors.infoLight : colors.disabledBackground,
            borderColor: hayPrestamo ? colors.info : colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons
          name="eye"
          size={22}
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
    marginTop: 4,
  },
  actionSub: {
    fontSize: 9,
    fontWeight: FontWeight.medium,
    marginTop: 1,
  },
});
