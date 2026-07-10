import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/components/ui/theme-provider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useAuthStore } from '@/store/auth.store';
import { changePassword } from '@/api/change-password.api';
import { logout } from '@/api/auth.api';
import { clearSession } from '@/utils/session';
import { changePasswordSchema,
  type ChangePasswordFormData } from '@/schemas/change-password.schema';
import type { ApiError } from '@/types/api.types';
import { AppInput } from '@/components/ui/app-input';
import { AppButton } from '@/components/ui/app-button';
import { useToast } from '@/components/ui/toast';
import { BorderRadius, FontSize, FontWeight, Shadows, Spacing } from '@/constants/theme';
function getStrength(
  password: string,
): { level: number; label: string; color: string; met: boolean[] } {
  const checks = [
    password.length >= 6,
    password.length >= 8,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /\d/.test(password),
  ];
  const metCount = checks.filter(Boolean).length;

  if (password.length === 0)
    return { level: 0, label: '', color: '', met: checks };
  if (metCount <= 1)
    return { level: 1, label: 'Débil', color: '#DC2626', met: checks };
  if (metCount <= 2)
    return { level: 2, label: 'Media', color: '#D97706', met: checks };
  return { level: 3, label: 'Fuerte', color: '#16A34A', met: checks };
}

const REQUIREMENTS = [
  { key: 'length', label: 'Mínimo 6 caracteres' },
  { key: 'min8', label: 'Al menos 8 caracteres' },
  { key: 'mixed', label: 'Mayúsculas y minúsculas' },
  { key: 'number', label: 'Al menos un número' },
];

export default function CambiarPasswordScreen() {
  const { colorScheme, colors } = useTheme();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const needsPasswordChange = useAuthStore(
    (state) => state.needsPasswordChange,
  );
  const { showToast } = useToast();

  const passwordRef = useRef<TextInput>(null);
  const [isReady, setIsReady] = useState(false);

  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(24);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { nuevaPassword: '', confirmarPassword: '' },
  });

  const nuevaPassword = useWatch({ control, name: 'nuevaPassword' });
  const confirmarPassword = useWatch({ control, name: 'confirmarPassword' });

  const strength = useMemo(
    () => getStrength(nuevaPassword || ''),
    [nuevaPassword],
  );

  const doPasswordsMatch =
    confirmarPassword && nuevaPassword
      ? confirmarPassword === nuevaPassword
      : null;

  useEffect(() => {
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const t = setTimeout(() => passwordRef.current?.focus(), 500);
    return () => clearTimeout(t);
  }, [isReady]);

  useEffect(() => {
    cardOpacity.value = withDelay(
      100,
      withTiming(1, { duration: 500 }),
    );
    cardTranslateY.value = withDelay(
      100,
      withSpring(0, { damping: 15, stiffness: 100 }),
    );
  }, []);

  const onSubmit = useCallback(
    async (data: ChangePasswordFormData) => {
      try {
        await changePassword(data.nuevaPassword);
        await logout().catch(() => {});
        await clearSession();
        showToast(
          'Contraseña cambiada exitosamente. Inicia sesión con tu nueva contraseña.',
          'success',
        );
      } catch (error) {
        const { message } = error as ApiError;
        setError('root', { message });
        showToast(message || 'Error al cambiar contraseña', 'error');
      }
    },
    [setError, showToast],
  );

  const handleWhatsApp = useCallback(() => {
    const message = 'Hola, tengo un problema con el cambio de contraseña en SAS Préstamos. ¿Me pueden ayudar?';
    Linking.openURL(
      `https://wa.me/18493512674?text=${encodeURIComponent(message)}`,
    );
  }, []);

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!needsPasswordChange) return <Redirect href="/dashboard" />;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.cardWrapper, cardAnimStyle]}>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, ...Shadows.md },
              ]}
            >
              <View style={styles.header}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: colors.warningLight },
                  ]}
                >
                  <Ionicons
                    name="lock-closed"
                    size={32}
                    color={colors.warning}
                  />
                </View>
                <Text style={[styles.title, { color: colors.text }]}>
                  Cambiar contraseña
                </Text>
                <Text
                  style={[
                    styles.subtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Por seguridad, debes cambiar tu contraseña antes de continuar
                </Text>
              </View>

              <View
                style={[
                  styles.warningBanner,
                  {
                    backgroundColor: colors.warningLight,
                    borderColor: colors.warning,
                  },
                ]}
              >
                <Ionicons
                  name="information-circle"
                  size={16}
                  color={colors.warning}
                />
                <Text
                  style={[styles.warningText, { color: colors.warning }]}
                >
                  Tu cuenta usa una contraseña temporal. Debes cambiarla antes
                  de continuar.
                </Text>
              </View>

              <Controller
                control={control}
                name="nuevaPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View>
                    <AppInput
                      ref={passwordRef}
                      label="Nueva contraseña"
                      placeholder="Mínimo 6 caracteres"
                      secureTextEntry
                      autoCapitalize="none"
                      autoComplete="new-password"
                      returnKeyType="next"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={errors.nuevaPassword?.message}
                    />
                    {strength.level > 0 && (
                      <View style={styles.strengthRow}>
                        <View
                          style={[
                            styles.strengthBar,
                            { backgroundColor: colors.border },
                          ]}
                        >
                          <View
                            style={[
                              styles.strengthFill,
                              {
                                width: `${(strength.level / 3) * 100}%`,
                                backgroundColor: strength.color,
                              },
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.strengthLabel,
                            { color: strength.color },
                          ]}
                        >
                          {strength.label}
                        </Text>
                      </View>
                    )}
                    <View style={styles.requirements}>
                      {REQUIREMENTS.map((req, idx) => (
                        <View key={req.key} style={styles.reqRow}>
                          <Ionicons
                            name={
                              strength.met[idx]
                                ? 'checkmark-circle'
                                : 'ellipse-outline'
                            }
                            size={14}
                            color={
                              strength.met[idx]
                                ? colors.success
                                : colors.textTertiary
                            }
                          />
                          <Text
                            style={[
                              styles.reqText,
                              {
                                color: strength.met[idx]
                                  ? colors.success
                                  : colors.textTertiary,
                              },
                            ]}
                          >
                            {req.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              />

              <Controller
                control={control}
                name="confirmarPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput
                    label="Confirmar contraseña"
                    placeholder="Repite la contraseña"
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="new-password"
                    returnKeyType="go"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.confirmarPassword?.message}
                    onSubmitEditing={handleSubmit(onSubmit)}
                    rightIcon={
                      doPasswordsMatch === null ? undefined : (
                        <Ionicons
                          name={
                            doPasswordsMatch
                              ? 'checkmark-circle'
                              : 'close-circle'
                          }
                          size={20}
                          color={
                            doPasswordsMatch
                              ? colors.success
                              : colors.error
                          }
                        />
                      )
                    }
                  />
                )}
              />

              {errors.root && (
                <View
                  style={[
                    styles.errorBanner,
                    {
                      backgroundColor: colors.errorLight,
                      borderColor: colors.error,
                    },
                  ]}
                >
                  <Ionicons
                    name="alert-circle"
                    size={16}
                    color={colors.error}
                  />
                  <Text style={[styles.errorText, { color: colors.error }]}>
                    {errors.root.message}
                  </Text>
                </View>
              )}

              <AppButton
                title="Cambiar contraseña"
                loading={isSubmitting}
                onPress={handleSubmit(onSubmit)}
                icon="checkmark-circle-outline"
              />
            </View>
          </Animated.View>

          <Pressable style={styles.whatsappRow} onPress={handleWhatsApp}>
            <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
            <Text style={[styles.whatsappText, { color: colors.textTertiary }]}>
              ¿Problemas? Chatea con nosotros
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  cardWrapper: {
    paddingHorizontal: Spacing.xs,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
    lineHeight: 20,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  warningText: {
    flex: 1,
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.sm,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    width: 40,
    textAlign: 'right',
  },
  requirements: {
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  reqText: {
    fontSize: FontSize.xs,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.sm,
  },
  whatsappRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginTop: Spacing.lg,
  },
  whatsappText: {
    fontSize: FontSize.sm,
  },
});
