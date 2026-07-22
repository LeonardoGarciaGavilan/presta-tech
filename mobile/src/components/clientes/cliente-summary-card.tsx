import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, FontWeight, Shadows, Spacing, scale} from '@/constants/theme';
import type { EstadoCuentaResponse } from '@/types/cliente.types';

interface ClienteSummaryProps {
  data: EstadoCuentaResponse;
  colors: any;
}

export default function ClienteSummary({ data, colors }: ClienteSummaryProps) {
  const c = data.cliente;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, Shadows.sm]}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {c.nombre.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]}>{c.nombre}</Text>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            Cédula: {c.cedula || 'N/A'}
          </Text>
          {c.celular && (
            <Text style={[styles.detail, { color: colors.textSecondary }]}>
              {c.celular}
            </Text>
          )}
        </View>
      </View>
      {c.direccion && (
        <Text style={[styles.address, { color: colors.textTertiary }]}>
          <Ionicons name="location-outline" size={scale(12)} color={colors.textTertiary} /> {c.direccion}
          {c.sector ? `, ${c.sector}` : ''}
          {c.municipio ? `, ${c.municipio}` : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    marginBottom: scale(2),
  },
  detail: {
    fontSize: FontSize.sm,
  },
  address: {
    fontSize: FontSize.xs,
    marginTop: Spacing.sm,
  },
});
