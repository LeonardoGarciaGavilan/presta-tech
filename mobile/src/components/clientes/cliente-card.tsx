import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { BorderRadius, FontSize, FontWeight, Shadows, Spacing } from '@/constants/theme';
import type { Cliente } from '@/types/cliente.types';
import ClienteAvatar from './cliente-avatar';
import { useTheme } from '@/components/ui/theme-provider';

interface ClienteCardProps {
  cliente: Cliente;
  onPress: () => void;
  onEstadoCuenta?: () => void;
  onEdit?: () => void;
  onToggleStatus?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ClienteCard({
  cliente,
  onPress,
  onEstadoCuenta,
  onEdit,
  onToggleStatus,
}: ClienteCardProps) {
  const { colorScheme, colors } = useTheme();
  const nombreCompleto =
    cliente.nombre + (cliente.apellido ? ` ${cliente.apellido}` : '');
  const telefono = cliente.celular ?? cliente.telefono;
  const tieneUbicacion = !!(cliente.latitud && cliente.longitud);
  const activo = cliente.activo;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, { damping: 20, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 20, stiffness: 300 });
  }, [scale]);

  return (
    <View
      style={[
        styles.card,
        Shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Touchable content area */}
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`Cliente ${nombreCompleto}`}
        style={animatedStyle}
      >
        <View style={styles.topRow}>
          <ClienteAvatar nombre={cliente.nombre} activo={activo} />
          <View style={styles.infoBlock}>
            <Text
              style={[styles.nombre, { color: colors.text }]}
              numberOfLines={1}
            >
              {nombreCompleto}
            </Text>
            <View style={styles.badges}>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: activo
                      ? colors.badgeActiveBg
                      : colors.badgeInactiveBg,
                  },
                ]}
              >
                <View
                  style={[
                    styles.badgeDot,
                    {
                      backgroundColor: activo
                        ? colors.badgeActive
                        : colors.badgeInactive,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color: activo
                        ? colors.badgeActive
                        : colors.badgeInactive,
                    },
                  ]}
                >
                  {activo ? 'Activo' : 'Inactivo'}
                </Text>
              </View>
              {tieneUbicacion && (
                <Ionicons
                  name="location-sharp"
                  size={14}
                  color={colors.primary}
                  style={styles.locationIcon}
                />
              )}
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textTertiary}
          />
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons
              name="card-outline"
              size={13}
              color={colors.textTertiary}
            />
            <Text
              style={[styles.detailText, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {cliente.cedula || 'Sin cédula'}
            </Text>
          </View>
          {telefono && (
            <View style={styles.detailItem}>
              <Ionicons
                name="call-outline"
                size={13}
                color={colors.textTertiary}
              />
              <Text
                style={[styles.detailText, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {telefono}
              </Text>
            </View>
          )}
        </View>

        {cliente.provincia && (
          <View style={styles.locationRow}>
            <Ionicons
              name="location-outline"
              size={13}
              color={colors.textTertiary}
            />
            <Text
              style={[styles.locationText, { color: colors.textTertiary }]}
              numberOfLines={1}
            >
              {[cliente.provincia, cliente.municipio, cliente.sector]
                .filter(Boolean)
                .join(' › ')}
            </Text>
          </View>
        )}
      </AnimatedPressable>

      {/* Action buttons — 4 squared icons (matching web: perfil, estados, editar, desactivar) */}
      <View style={[styles.actionsRow, { borderTopColor: colors.borderLight }]}>
        {activo ? (
          <>
            <TouchableOpacity
              onPress={onPress}
              accessibilityLabel="Ver perfil"
              activeOpacity={0.7}
              style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            {onEstadoCuenta && (
              <TouchableOpacity
                onPress={onEstadoCuenta}
                accessibilityLabel="Estado de cuenta"
                activeOpacity={0.7}
                style={[styles.actionBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}

            {onEdit && (
              <TouchableOpacity
                onPress={onEdit}
                accessibilityLabel="Editar cliente"
                activeOpacity={0.7}
                style={[styles.actionBtn, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}
              >
                <Ionicons name="pencil-outline" size={18} color={colors.warning} />
              </TouchableOpacity>
            )}

            {onToggleStatus && (
              <TouchableOpacity
                onPress={onToggleStatus}
                accessibilityLabel="Deshabilitar cliente"
                activeOpacity={0.7}
                style={[styles.actionBtn, { backgroundColor: colors.errorLight, borderColor: colors.error }]}
              >
                <Ionicons name="ban-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            )}
          </>
        ) : (
          onToggleStatus && (
            <TouchableOpacity
              onPress={onToggleStatus}
              accessibilityLabel="Reactivar cliente"
              activeOpacity={0.7}
              style={[styles.actionBtn, styles.actionBtnFull, { backgroundColor: colors.successLight, borderColor: colors.success }]}
            >
              <Ionicons name="refresh-outline" size={18} color={colors.success} />
            </TouchableOpacity>
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingBottom: 0,
  },
  infoBlock: {
    flex: 1,
    marginLeft: Spacing.sm,
    marginRight: Spacing.xs,
  },
  nombre: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  locationIcon: {
    marginLeft: Spacing.xs,
  },
  detailsRow: {
    flexDirection: 'row',
    padding: Spacing.md,
    paddingBottom: 0,
    gap: Spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: FontSize.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingBottom: 0,
    gap: 4,
  },
  locationText: {
    fontSize: FontSize.xs,
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    padding: Spacing.md,
    borderTopWidth: 1,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionBtnFull: {
    flex: 1,
  },
});
