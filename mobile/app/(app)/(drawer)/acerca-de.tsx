import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

import { ScreenContainer } from '@/components/ui/screen-container';
import { SectionCard } from '@/components/ui/section-card';
import { useTheme } from '@/components/ui/theme-provider';
import { BorderRadius, FontSize, FontWeight, scale, Spacing } from '@/constants/theme';

export default function AcercaDeScreen() {
  const { colors } = useTheme();

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: getSolid() }]}>
          <View style={styles.heroContent}>
            <View style={styles.logoWrap}>
              <Ionicons name="information-circle-outline" size={scale(34)} color="#FFFFFF" />
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroTitle}>Acerca de PrestaTech</Text>
              <Text style={styles.heroSubtitle}>Información de la aplicación</Text>
            </View>
          </View>
        </View>

        <SectionCard
          icon="ℹ️"
          title="Información"
          description="Detalles de la aplicación"
          colors={colors}
        >
          <View style={[styles.aboutRow, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.aboutLabel, { color: colors.textTertiary }]}>
              Aplicación
            </Text>
            <Text style={[styles.aboutValue, { color: colors.text }]}>PrestaTech</Text>
          </View>
          <View style={[styles.aboutRow, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.aboutLabel, { color: colors.textTertiary }]}>
              Versión
            </Text>
            <Text style={[styles.aboutValue, { color: colors.text }]}>
              {Constants.expoConfig?.version || '—'}
            </Text>
          </View>
          <View style={[styles.aboutRow, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.aboutLabel, { color: colors.textTertiary }]}>
              Plataforma
            </Text>
            <Text style={[styles.aboutValue, { color: colors.text }]}>Móvil</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.textTertiary }]}>
              Sector
            </Text>
            <Text style={[styles.aboutValue, { color: colors.text }]}>
              Financiero
            </Text>
          </View>
        </SectionCard>

        <Text style={[styles.footer, { color: colors.textTertiary }]}>
          PrestaTech © {new Date().getFullYear()}. Todos los derechos reservados.
        </Text>
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
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  aboutLabel: {
    fontSize: FontSize.sm,
  },
  aboutValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  footer: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});