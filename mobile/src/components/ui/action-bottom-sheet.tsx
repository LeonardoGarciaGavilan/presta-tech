import { useEffect, useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderRadius, FontSize, FontWeight, Spacing, scale } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';
import { HoldToConfirmButton } from '@/components/ui/hold-to-confirm-button';

export interface ActionItem {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  requiresHold?: boolean;
  destructive?: boolean;
  selected?: boolean;
}

export interface ActionGroup {
  key: string;
  actions: ActionItem[];
}

interface ActionBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  groups: ActionGroup[];
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ActionBottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  groups,
  style,
}: ActionBottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(600);
  const innerScale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
      translateY.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    } else {
      opacity.value = withTiming(0, { duration: 160, easing: Easing.in(Easing.cubic) });
      translateY.value = withTiming(600, { duration: 200, easing: Easing.in(Easing.cubic) });
    }
  }, [visible, opacity, translateY]);

  const handleAction = (item: ActionItem) => {
    if (item.disabled || item.loading) return;
    if (item.requiresHold) {
      if (item.onPress) item.onPress();
      return;
    }
    onClose();
    if (item.onPress) item.onPress();
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: innerScale.value }],
  }));

  const flatActions = useMemo(
    () => groups.reduce<ActionItem[]>((acc, g) => acc.concat(g.actions), []),
    [groups],
  );

  const hasHoldAction = useMemo(
    () => flatActions.some((a) => a.requiresHold),
    [flatActions],
  );

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <AnimatedPressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }, backdropStyle]}
          onPress={onClose}
          accessibilityLabel="Cerrar opciones"
          accessibilityRole="button"
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: Math.max(insets.bottom, Spacing.lg),
            },
            sheetStyle,
            style,
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              {subtitle && (
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
              )}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={scale(22)} color={colors.textTertiary} />
            </Pressable>
          </View>

          <View style={styles.scrollContent}>
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              style={{ flexGrow: 1 }}
              contentContainerStyle={styles.scrollInner}
            >
              {groups.map((group, index) => (
                <View key={group.key}>
                  {index > 0 && (
                    <View style={[styles.separator, { backgroundColor: colors.border }]} />
                  )}
                  {group.actions.map((item) => {
                    const actionColor = item.color ?? colors.primary;
                    if (item.requiresHold) {
                      return (
                        <View key={item.id} style={styles.holdRow}>
                          <HoldToConfirmButton
                            title={item.label}
                            icon={item.icon ?? 'warning-outline'}
                            variant={item.destructive ? 'danger' : 'primary'}
                            onConfirm={() => {
                              onClose();
                              if (item.onPress) item.onPress();
                            }}
                            disabled={item.disabled}
                            loading={item.loading}
                          />
                        </View>
                      );
                    }

                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => handleAction(item)}
                        disabled={item.disabled || item.loading}
                        accessibilityRole="button"
                        accessibilityLabel={item.label}
                        accessibilityState={{
                          disabled: item.disabled || item.loading,
                          selected: item.selected,
                        }}
                        style={({ pressed }) => [
                          styles.actionRow,
                          item.selected && { backgroundColor: `${colors.primary}14` },
                          pressed && !item.disabled
                            ? { backgroundColor: colors.primaryLight }
                            : null,
                        ]}
                      >
                        {item.icon ? (
                          <View
                            style={[
                              styles.iconWrap,
                              { backgroundColor: `${actionColor}18` },
                            ]}
                          >
                            <Ionicons
                              name={item.icon}
                              size={scale(20)}
                              color={item.disabled ? colors.disabled : actionColor}
                            />
                          </View>
                        ) : item.selected ? (
                          <View
                            style={[
                              styles.iconWrap,
                              { backgroundColor: `${colors.primary}18` },
                            ]}
                          >
                            <Ionicons
                              name="checkmark"
                              size={scale(20)}
                              color={colors.primary}
                            />
                          </View>
                        ) : null}
                        <Text
                          style={[
                            styles.actionLabel,
                            {
                              color: item.selected
                                ? colors.primary
                                : item.disabled
                                  ? colors.disabled
                                  : item.destructive
                                    ? colors.error
                                    : colors.text,
                            },
                          ]}
                        >
                          {item.label}
                        </Text>
                        {item.loading ? (
                          <Ionicons name="sync" size={scale(18)} color={colors.textTertiary} />
                        ) : (
                          <Ionicons
                            name="chevron-forward"
                            size={scale(16)}
                            color={colors.textTertiary}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>

          {hasHoldAction && (
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              Mantén presionado para confirmar acciones irreversibles
            </Text>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: scale(40),
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: 'rgba(128, 128, 128, 0.35)',
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  closeBtn: {
    width: scale(36),
    height: scale(36),
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    fontSize: FontSize.sm,
    marginTop: scale(2),
  },
  scrollContent: {
    flexGrow: 1,
    flexShrink: 1,
    overflow: 'hidden',
  },
  scrollInner: {
    paddingBottom: Spacing.xs,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: scale(56),
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  iconWrap: {
    width: scale(36),
    height: scale(36),
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  actionLabel: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  holdRow: {
    marginVertical: Spacing.xs,
  },
  hint: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});