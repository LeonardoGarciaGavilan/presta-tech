import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '@/components/ui/app-button';
import { ScreenContainer } from '@/components/ui/screen-container';
import { SectionCard } from '@/components/ui/section-card';
import { useTheme } from '@/components/ui/theme-provider';
import { BorderRadius, FontSize, FontWeight, scale, Spacing } from '@/constants/theme';

const CONTACTO_WHATSAPP = '18493512674';

export default function AyudaScreen() {
  const { colors } = useTheme();

  const handleWhatsApp = () => {
    const message = 'Hola, estoy usando PrestaTech y necesito ayuda. ¿Me pueden asistir?';
    Linking.openURL(`https://wa.me/${CONTACTO_WHATSAPP}?text=${encodeURIComponent(message)}`);
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: getSolid()} ]}>
          <View style={styles.heroContent}>
            <View style={styles.logoWrap}>
              <Ionicons name="help-buoy-outline" size={scale(34)} color="#FFFFFF" />
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroTitle}>Ayuda y soporte</Text>
              <Text style={styles.heroSubtitle}>Estamos aquí para acompañarte</Text>
            </View>
          </View>
        </View>

        <SectionCard
          icon="❓"
          title="Preguntas frecuentes"
          description="Respuestas rápidas a dudas comunes"
          colors={colors}
        >
          <View style={[styles.faqItem, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.faqQuestion, { color: colors.text }]}>¿Cómo sincronizo mis datos?</Text>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
              Entra a la pestaña Más y toca la tarjeta de Sincronización. Asegúrate de tener conexión a internet.
            </Text>
          </View>
          <View style={[styles.faqItem, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.faqQuestion, { color: colors.text }]}>¿Trabajo sin conexión?</Text>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
              Sí. La app funciona sin conexión y guarda tus operaciones. Se sincronizan automáticamente cuando vuelves a tener internet.
            </Text>
          </View>
          <View>
            <Text style={[styles.faqQuestion, { color: colors.text }]}>¿Dónde imprimo recibos?</Text>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
              En la pestaña Más, dentro de Acceso rápido, toca Impresora para conectar y configurar tu impresora térmica.
            </Text>
          </View>
        </SectionCard>

        <SectionCard
          icon="💬"
          title="Contacto directo"
          description="¿Necesitas ayuda personalizada?"
          colors={colors}
        >
          <AppButton
            title="Escribir por WhatsApp"
            onPress={handleWhatsApp}
            icon="logo-whatsapp"
            variant="secondary"
          />
        </SectionCard>
      </ScrollView>
    </ScreenContainer>
  );
}

function getSolid() {
  return '#7C4DFF';
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  hero: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  logoWrap: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(16),
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroInfo: {
    flex: 1,
  },
  heroTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  heroSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: scale(2),
  },
  faqItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  faqQuestion: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  faqAnswer: {
    fontSize: FontSize.xs,
    marginTop: scale(2),
    lineHeight: scale(16),
  },
});