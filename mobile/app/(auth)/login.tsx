import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useAuthStore } from '@/store/auth.store';
import { login } from '@/api/auth.api';
import { loginSchema, type LoginFormData } from '@/schemas/login.schema';
import type { ApiError } from '@/types/api.types';
import { AppInput } from '@/components/ui/app-input';
import { AppButton } from '@/components/ui/app-button';
import { useToast } from '@/components/ui/toast';
import { BorderRadius, FontSize, FontWeight, Shadows, Spacing, scale } from '@/constants/theme';
import storage from '@/utils/storage';
import { useTheme } from '@/components/ui/theme-provider';

const STORAGE_KEY_EMAIL = 'saved_email';

export default function LoginScreen() {
  const { colorScheme, colors } = useTheme();
  const setUser = useAuthStore((state) => state.setUser);
  const setNeedsPasswordChange = useAuthStore(
    (state) => state.setNeedsPasswordChange,
  );
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { showToast } = useToast();

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [rememberEmail, setRememberEmail] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.92);
  const cardOpacity = useSharedValue(0);

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    (async () => {
      try {
        const saved = await storage.getItem(STORAGE_KEY_EMAIL);
        if (saved) {
          setValue('email', saved);
          setRememberEmail(true);
        }
      } catch {}
      setIsReady(true);
    })();
  }, [setValue]);

  useEffect(() => {
    if (!isReady) return;
    const t1 = setTimeout(() => emailRef.current?.focus(), 500);
    return () => clearTimeout(t1);
  }, [isReady]);

  useEffect(() => {
    logoScale.value = withDelay(
      100,
      withSpring(1, { damping: 12, stiffness: 100 }),
    );
    logoOpacity.value = withDelay(100, withTiming(1, { duration: 400 }));
    cardScale.value = withDelay(
      400,
      withSpring(1, { damping: 15, stiffness: 100 }),
    );
    cardOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
  }, []);

  const onSubmit = useCallback(
    async (data: LoginFormData) => {
      try {
        const response = await login(data);
        setUser(response.usuario);

        if (rememberEmail) {
          await storage.setItem(STORAGE_KEY_EMAIL, data.email);
        } else {
          await storage.removeItem(STORAGE_KEY_EMAIL);
        }

        if (response.requiereCambioPassword) {
          setNeedsPasswordChange(true);
          router.replace('/cambiar-password');
          return;
        }

        router.replace('/dashboard');
      } catch (error) {
        const { message, minutosRestantes } = error as ApiError;
        const errorMsg = minutosRestantes
          ? `Demasiados intentos. Intenta de nuevo en ${minutosRestantes} minuto(s).`
          : message || 'Error al iniciar sesión';
        setError('root', { message: errorMsg });
        showToast(errorMsg, 'error');
      }
    },
    [setUser, setNeedsPasswordChange, setError, showToast, rememberEmail],
  );

  const handleWhatsApp = useCallback(() => {
    const message = 'Hola, tengo un problema para iniciar sesión en PrestaTech. ¿Me pueden ayudar?';
    Linking.openURL(
      `https://wa.me/18493512674?text=${encodeURIComponent(message)}`,
    );
  }, []);

  const logoAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated]);

  if (isAuthenticated) {
    return null;
  }

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
          <Animated.View style={[styles.logoSection, logoAnimStyle]}>
            <View
              style={[
                styles.logoCircle,
                { backgroundColor: colors.surfaceElevated },
              ]}
            >
              <Ionicons
                name="shield-checkmark"
                size={scale(40)}
                color={colors.primary}
              />
            </View>
            <Text style={[styles.appName, { color: colors.text }]}>
              PrestaTech
            </Text>
            <Text style={[styles.tagline, { color: colors.textTertiary }]}>
              Gestión de préstamos inteligente
            </Text>
          </Animated.View>

          <Animated.View style={[styles.cardWrapper, cardAnimStyle]}>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, ...Shadows.md },
              ]}
            >
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput
                    ref={emailRef}
                    label="Correo electrónico"
                    placeholder="tu@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    returnKeyType="next"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.email?.message}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput
                    ref={passwordRef}
                    label="Contraseña"
                    placeholder="Ingresa tu contraseña"
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="password"
                    returnKeyType="go"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.password?.message}
                    onSubmitEditing={handleSubmit(onSubmit)}
                  />
                )}
              />

              <Pressable
                style={styles.rememberRow}
                onPress={() => setRememberEmail((prev) => !prev)}
              >
                <Ionicons
                  name={rememberEmail ? 'checkbox' : 'square-outline'}
                  size={scale(20)}
                  color={
                    rememberEmail ? colors.primary : colors.textTertiary
                  }
                />
                <Text
                  style={[styles.rememberText, { color: colors.textSecondary }]}
                >
                  Recordar correo
                </Text>
              </Pressable>

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
                    size={scale(16)}
                    color={colors.error}
                  />
                  <Text style={[styles.errorText, { color: colors.error }]}>
                    {errors.root.message}
                  </Text>
                </View>
              )}

              <Pressable
                onPress={() =>
                  showToast(
                    'Comunícate con el administrador para restablecer tu contraseña.',
                    'info',
                  )
                }
                style={styles.forgotLink}
              >
                <Text style={[styles.forgotText, { color: colors.primary }]}>
                  ¿Olvidaste tu contraseña?
                </Text>
              </Pressable>

              <AppButton
                title="Ingresar"
                loading={isSubmitting}
                onPress={handleSubmit(onSubmit)}
                icon="log-in-outline"
              />
            </View>
          </Animated.View>

          <Pressable style={styles.whatsappRow} onPress={handleWhatsApp}>
            <Ionicons name="logo-whatsapp" size={scale(18)} color="#25D366" />
            <Text style={[styles.whatsappText, { color: colors.textTertiary }]}>
              ¿Problemas para iniciar? Chatea con nosotros
            </Text>
          </Pressable>

          <Text style={[styles.footer, { color: colors.textTertiary }]}>
            © {new Date().getFullYear()} PrestaTech
          </Text>
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
  logoSection: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  logoCircle: {
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  appName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: FontSize.sm,
  },
  cardWrapper: {
    paddingHorizontal: Spacing.xs,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    marginTop: -Spacing.xs,
  },
  rememberText: {
    fontSize: FontSize.sm,
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
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.lg,
  },
  forgotText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
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
  footer: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    marginTop: Spacing.sm,
  },
});
