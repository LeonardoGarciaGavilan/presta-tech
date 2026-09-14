import { memo, useCallback, useRef } from 'react';
import { Animated as RNAnimated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { BorderRadius, FontSize, FontWeight, Shadows, Spacing, scale } from '@/constants/theme';
import type { Cliente } from '@/types/cliente.types';
import ClienteAvatar from './cliente-avatar';
import Badge from '@/components/ui/badge';
import ClickToCall from '@/components/ui/click-to-call';
import { useTheme, getSolidFill } from '@/components/ui/theme-provider';

interface ClienteCardProps {
  cliente: Cliente;
  onPress: () => void;
  onEstadoCuenta?: () => void;
  onEdit?: () => void;
  onToggleStatus?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ClienteCardBase({
  cliente,
  onPress,
  onEstadoCuenta,
  onEdit,
  onToggleStatus,
}: ClienteCardProps) {
  const { colorScheme, colors } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);
  const nombreCompleto =
    cliente.nombre + (cliente.apellido ? ` ${cliente.apellido}` : '');
  const telefono = cliente.celular ?? cliente.telefono;
  const activo = cliente.activo;
  const animScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animScale.value }],
  }));

  const handlePressIn = useCallback(() => {
    animScale.value = withSpring(0.98, { damping: 20, stiffness: 300 });
  }, [animScale]);

  const handlePressOut = useCallback(() => {
    animScale.value = withSpring(1, { damping: 20, stiffness: 300 });
  }, [animScale]);

  const closeSwipe = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  const renderRightActions = (
    progress: RNAnimated.AnimatedInterpolation<number>,
  ) => {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [120, 0],
    });

    return (
      <View style={styles.swipeActions}>
        {onEdit && (
          <RNAnimated.View style={[styles.swipeAction, { transform: [{ translateX }] }]}>
            <Pressable
              onPress={() => { closeSwipe(); onEdit(); }}
              style={[styles.swipeBtn, { backgroundColor: getSolidFill(colors, colorScheme, 'warning') }]}
              accessibilityLabel="Editar cliente"
            >
              <Ionicons name="pencil" size={scale(18)} color="#FFFFFF" />
              <Text style={styles.swipeBtnText}>Editar</Text>
            </Pressable>
          </RNAnimated.View>
        )}

        {onEstadoCuenta && (
          <RNAnimated.View style={[styles.swipeAction, { transform: [{ translateX }] }]}>
            <Pressable
              onPress={() => { closeSwipe(); onEstadoCuenta(); }}
              style={[styles.swipeBtn, { backgroundColor: getSolidFill(colors, colorScheme, 'primary') }]}
              accessibilityLabel="Estado de cuenta"
            >
              <Ionicons name="document-text" size={scale(18)} color="#FFFFFF" />
              <Text style={styles.swipeBtnText}>Cuenta</Text>
            </Pressable>
          </RNAnimated.View>
        )}

        {onToggleStatus && (
          <RNAnimated.View style={[styles.swipeAction, { transform: [{ translateX }] }]}>
            <Pressable
              onPress={() => { closeSwipe(); onToggleStatus(); }}
              style={[
                styles.swipeBtn,
                { backgroundColor: activo ? getSolidFill(colors, colorScheme, 'error') : getSolidFill(colors, colorScheme, 'success') },
              ]}
              accessibilityLabel={activo ? 'Deshabilitar cliente' : 'Reactivar cliente'}
            >
              <Ionicons
                name={activo ? 'ban' : 'refresh'}
                size={scale(18)}
                color="#FFFFFF"
              />
              <Text style={styles.swipeBtnText}>
                {activo ? 'Deshabilitar' : 'Reactivar'}
              </Text>
            </Pressable>
          </RNAnimated.View>
        )}
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
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
        <AnimatedPressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityRole="button"
          accessibilityLabel={`Cliente ${nombreCompleto}, ${activo ? 'activo' : 'inactivo'}`}
          accessibilityHint={
            onEdit || onEstadoCuenta || onToggleStatus
              ? 'Toca para ver el detalle. Desliza a la izquierda para ver más acciones.'
              : undefined
          }
          style={animatedStyle}
        >
          <View style={styles.contentRow}>
            <ClienteAvatar nombre={cliente.nombre} activo={activo} size={36} />
            <View style={styles.infoBlock}>
              <Text
                style={[styles.nombre, { color: colors.text }]}
                numberOfLines={1}
              >
                {nombreCompleto}
              </Text>
              <View style={styles.detailLine}>
                <Badge
                  icon={activo ? 'checkmark-circle' : 'ban'}
                  label={activo ? 'Activo' : 'Inactivo'}
                  color={activo ? (colorScheme === 'dark' ? colors.badgeActive : colors.successDark) : colors.badgeInactive}
                  bg={activo ? colors.badgeActiveBg : colors.badgeInactiveBg}
                />
                <Text
                  style={[styles.detailText, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {cliente.cedula || 'Sin cédula'}
                </Text>
                {telefono && (
                  <>
                    <Text style={[styles.detailSeparator, { color: colors.textTertiary }]}>·</Text>
                    <ClickToCall
                      compact
                      phone={telefono}
                      textStyle={[styles.detailText, { color: colors.textSecondary }]}
                      iconColor={colors.textTertiary}
                    />
                  </>
                )}
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={scale(16)}
              color={colors.textTertiary}
            />
          </View>
        </AnimatedPressable>
      </View>
    </Swipeable>
  );
}

const ClienteCard = memo(ClienteCardBase);
ClienteCard.displayName = 'ClienteCard';

export default ClienteCard;

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  infoBlock: {
    flex: 1,
    gap: scale(2),
  },
  nombre: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  detailLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  detailText: {
    fontSize: FontSize.xs,
  },
  detailSeparator: {
    fontSize: FontSize.xs,
    marginHorizontal: scale(1),
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    height: '100%',
    gap: scale(2),
  },
  swipeBtnText: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
});
