import { memo, useCallback, useRef } from 'react';
import { Animated as RNAnimated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { router } from 'expo-router';

import { BorderRadius, FontSize, FontWeight, Spacing, scale } from '@/constants/theme';
import { useTheme, getSolidFill } from '@/components/ui/theme-provider';

interface RutaCardProps {
  ruta: any;
  puedeAsignar: boolean;
  puedeEliminar: boolean;
  onAsignar: (rutaId: string, usuarioId?: string) => void;
  onDesactivar: (rutaId: string) => void;
}

function RutaCardBase({
  ruta,
  puedeAsignar,
  puedeEliminar,
  onAsignar,
  onDesactivar,
}: RutaCardProps) {
  const { colorScheme, colors } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  const closeSwipe = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  const renderRightActions = (progress: RNAnimated.AnimatedInterpolation<number>) => {
    const count = (puedeAsignar ? 1 : 0) + (puedeEliminar ? 1 : 0);
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [count * 84, 0],
    });

    return (
      <View style={styles.swipeActions}>
        {puedeAsignar && (
          <RNAnimated.View style={[styles.swipeAction, { transform: [{ translateX }] }]}>
            <Pressable
              onPress={() => {
                closeSwipe();
                onAsignar(ruta.id, ruta.usuario?.id);
              }}
              style={[styles.swipeBtn, { backgroundColor: getSolidFill(colors, colorScheme, 'primary') }]}
              accessibilityRole="button"
              accessibilityLabel={
                ruta.usuario
                  ? `Reasignar cobrador, actual: ${ruta.usuario.nombre}`
                  : 'Asignar cobrador'
              }
            >
              <Ionicons
                name={ruta.usuario ? 'swap-horizontal' : 'person-add-outline'}
                size={scale(18)}
                color="#FFFFFF"
              />
              <Text style={styles.swipeBtnText}>
                {ruta.usuario ? 'Reasignar' : 'Asignar'}
              </Text>
            </Pressable>
          </RNAnimated.View>
        )}
        {puedeEliminar && (
          <RNAnimated.View style={[styles.swipeAction, { transform: [{ translateX }] }]}>
            <Pressable
              onPress={() => {
                closeSwipe();
                onDesactivar(ruta.id);
              }}
              style={[styles.swipeBtn, { backgroundColor: getSolidFill(colors, colorScheme, 'error') }]}
              accessibilityRole="button"
              accessibilityLabel="Desactivar ruta"
            >
              <Ionicons name="ban-outline" size={scale(18)} color="#FFFFFF" />
              <Text style={styles.swipeBtnText}>Desactivar</Text>
            </Pressable>
          </RNAnimated.View>
        )}
      </View>
    );
  };

  const cardContent = (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        onPress={() => router.push(`/rutas/${ruta.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`Ruta ${ruta.nombre}, ${ruta.clientes?.length ?? 0} clientes`}
        accessibilityHint={
          puedeAsignar || puedeEliminar
            ? 'Toca para abrir la ruta. Desliza a la izquierda para ver más acciones.'
            : undefined
        }
      >
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: colors.routeBg }]}>
            <Ionicons name="map-outline" size={scale(20)} color={colors.route} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
              {ruta.nombre}
            </Text>
            {ruta.descripcion && (
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                {ruta.descripcion}
              </Text>
            )}
          </View>
          {!ruta.activa && (
            <View style={[styles.inactiveBadge, { backgroundColor: colors.errorLight }]}>
              <Text style={[styles.inactiveText, { color: colors.error }]}>Inactiva</Text>
            </View>
          )}
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            {ruta.usuario && (
              <Pressable
                style={styles.cobradorRow}
                onPress={() => {
                  if (puedeAsignar) onAsignar(ruta.id, ruta.usuario?.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Cobrador: ${ruta.usuario.nombre}`}
              >
                <Ionicons
                  name="person-outline"
                  size={scale(12)}
                  color={puedeAsignar ? colors.primary : colors.textTertiary}
                />
                <Text style={[styles.cobradorText, { color: puedeAsignar ? colors.primary : colors.textTertiary }]}>
                  {ruta.usuario.nombre}
                </Text>
                {puedeAsignar && <Ionicons name="chevron-forward" size={scale(12)} color={colors.primary} />}
              </Pressable>
            )}
            {puedeAsignar && !ruta.usuario && (
              <Pressable
                style={styles.cobradorRow}
                onPress={() => onAsignar(ruta.id, '')}
                accessibilityRole="button"
                accessibilityLabel="Asignar cobrador"
              >
                <Ionicons name="person-add-outline" size={scale(12)} color={colors.primary} />
                <Text style={[styles.cobradorText, { color: colors.primary }]}>
                  Asignar cobrador
                </Text>
              </Pressable>
            )}
          </View>
          <View style={styles.clientCount}>
            <Ionicons name="people-outline" size={scale(12)} color={colors.textTertiary} />
            <Text style={[styles.clientCountText, { color: colors.textTertiary }]}>
              {ruta.clientes?.length ?? 0} clientes
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  );

  if (!puedeAsignar && !puedeEliminar) {
    return cardContent;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      {cardContent}
    </Swipeable>
  );
}

const RutaCard = memo(RutaCardBase);
RutaCard.displayName = 'RutaCard';

export default RutaCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  cardDesc: {
    fontSize: FontSize.sm,
    marginTop: scale(1),
  },
  inactiveBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(2),
    borderRadius: BorderRadius.sm,
  },
  inactiveText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'transparent',
  },
  footerLeft: {
    flex: 1,
  },
  cobradorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  cobradorText: {
    fontSize: FontSize.xs,
  },
  clientCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  clientCountText: {
    fontSize: FontSize.xs,
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
    width: 84,
    height: '100%',
    gap: scale(2),
  },
  swipeBtnText: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
});