import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, FontWeight, Spacing, scale} from '@/constants/theme';
import type { Cliente } from '@/types/cliente.types';
import { useTheme } from '@/components/ui/theme-provider';
import ClickToCall from '@/components/ui/click-to-call';
import { formatCurrency } from '@/utils/formatters';

interface ClienteInfoProps {
  cliente: Cliente;
}

interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | number | null;
  phone?: boolean;
}

function InfoRow({ icon, label, value, phone }: InfoRowProps) {
  const { colors } = useTheme();
  const isEmpty = value === null || value === undefined || value === '';

  if (isEmpty) return null;

  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={scale(15)} color={colors.textTertiary} />
      <View style={styles.infoContent}>
        <Text style={[styles.label, { color: colors.textTertiary }]}>
          {label}
        </Text>
        {phone ? (
          <ClickToCall
            phone={String(value)}
            showIcon={false}
            textStyle={[styles.value, { color: colors.text }]}
          />
        ) : (
          <Text style={[styles.value, { color: colors.text }]}>{String(value)}</Text>
        )}
      </View>
    </View>
  );
}

function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  const { colors } = useTheme();

  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={scale(16)} color={colors.primary} />
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );
}

export default function ClienteInfo({ cliente }: ClienteInfoProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrapper}>
      {/* Información de Contacto */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <SectionHeader icon="call-outline" title="Contacto" />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        {cliente.telefono && (
          <InfoRow icon="call-outline" label="Teléfono" value={cliente.telefono} phone />
        )}
        {cliente.celular && (
          <InfoRow icon="phone-portrait-outline" label="Celular" value={cliente.celular} phone />
        )}
        {cliente.email && (
          <InfoRow icon="mail-outline" label="Correo" value={cliente.email} />
        )}
      </View>

      {/* Dirección */}
      {(cliente.provincia || cliente.municipio || cliente.sector || cliente.direccion) && (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <SectionHeader icon="location-outline" title="Dirección" />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <InfoRow icon="map-outline" label="Provincia" value={cliente.provincia} />
          <InfoRow icon="map-outline" label="Municipio" value={cliente.municipio} />
          <InfoRow icon="map-outline" label="Sector" value={cliente.sector} />
          <InfoRow icon="home-outline" label="Dirección" value={cliente.direccion} />
        </View>
      )}

      {/* Información Laboral */}
      {(cliente.ocupacion || cliente.empresaLaboral || cliente.ingresos != null) && (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <SectionHeader icon="briefcase-outline" title="Laboral" />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <InfoRow icon="briefcase-outline" label="Ocupación" value={cliente.ocupacion} />
          <InfoRow icon="business-outline" label="Empresa" value={cliente.empresaLaboral} />
          {cliente.ingresos != null && (
            <InfoRow
              icon="trending-up-outline"
              label="Ingresos mensuales"
              value={`${formatCurrency(cliente.ingresos)}`}
            />
          )}
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
          <SectionHeader icon="document-text-outline" title="Observaciones" />
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  divider: {
    height: scale(1),
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
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