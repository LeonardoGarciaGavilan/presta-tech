import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, FontWeight, Spacing, scale} from '@/constants/theme';
import type { Cliente } from '@/types/cliente.types';
import { useTheme } from '@/components/ui/theme-provider';

interface ClienteInfoProps {
  cliente: Cliente;
}

interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | number | null;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  const { colorScheme, colors } = useTheme();
  const display =
    value === null || value === undefined || value === ''
      ? 'No disponible'
      : String(value);

  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={scale(15)} color={colors.textTertiary} />
      <View style={styles.infoContent}>
        <Text style={[styles.label, { color: colors.textTertiary }]}>
          {label}
        </Text>
        <Text style={[styles.value, { color: colors.text }]}>{display}</Text>
      </View>
    </View>
  );
}

function formatIngresos(value: number | null): string {
  if (value === null || value === undefined) return 'No disponible';
  return `RD$ ${new Intl.NumberFormat('es-DO').format(value)}`;
}

export default function ClienteInfo({ cliente }: ClienteInfoProps) {
  const { colorScheme, colors } = useTheme();

  return (
    <View style={styles.wrapper}>
      {/* Información General */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          <Ionicons name="person-outline" size={scale(16)} color={colors.primary} />{' '}
          Información General
        </Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <InfoRow icon="person-outline" label="Nombre" value={cliente.nombre} />
        {cliente.apellido && (
          <InfoRow icon="person-outline" label="Apellido" value={cliente.apellido} />
        )}
        <InfoRow icon="card-outline" label="Cédula" value={cliente.cedula} />
      </View>

      {/* Información de Contacto */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          <Ionicons name="call-outline" size={scale(16)} color={colors.primary} />{' '}
          Contacto
        </Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        {cliente.telefono && (
          <InfoRow icon="call-outline" label="Teléfono" value={cliente.telefono} />
        )}
          <InfoRow icon="phone-portrait-outline" label="Celular" value={cliente.celular} />
        <InfoRow icon="mail-outline" label="Correo" value={cliente.email} />
      </View>

      {/* Dirección */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          <Ionicons name="location-outline" size={scale(16)} color={colors.primary} />{' '}
          Dirección
        </Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <InfoRow icon="map-outline" label="Provincia" value={cliente.provincia} />
        <InfoRow icon="map-outline" label="Municipio" value={cliente.municipio} />
        <InfoRow icon="map-outline" label="Sector" value={cliente.sector} />
        <InfoRow icon="home-outline" label="Dirección" value={cliente.direccion} />
      </View>

      {/* Información Laboral */}
      {(cliente.ocupacion || cliente.empresaLaboral) && (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            <Ionicons name="briefcase-outline" size={scale(16)} color={colors.primary} />{' '}
            Laboral
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <InfoRow icon="briefcase-outline" label="Ocupación" value={cliente.ocupacion} />
          <InfoRow
            icon="business-outline"
            label="Empresa"
            value={cliente.empresaLaboral}
          />
        </View>
      )}

      {/* Observaciones */}
      {cliente.observaciones && (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            <Ionicons name="document-text-outline" size={scale(16)} color={colors.primary} />{' '}
            Observaciones
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.observations, { color: colors.text }]}>
            {cliente.observaciones}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  divider: {
    height: scale(1),
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  infoContent: {
    flex: 1,
  },
  label: {
    fontSize: FontSize.xs,
    marginBottom: scale(1),
  },
  value: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  observations: {
    fontSize: FontSize.sm,
    lineHeight: scale(20),
  },
});
