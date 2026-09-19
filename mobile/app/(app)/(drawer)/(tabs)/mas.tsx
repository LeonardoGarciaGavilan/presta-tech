import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/ui/screen-container';
import SearchBar from '@/components/ui/search-bar';
import EmptyState from '@/components/ui/empty-state';
import { QuickCard } from '@/components/mas/module-quick-card';
import { ModuleRow } from '@/components/mas/module-row';
import {
  CATEGORIAS,
  MODULOS,
  filtrarModulo,
  type ModuloItem,
} from '@/components/mas/modulos.data';
import { useTheme } from '@/components/ui/theme-provider';
import { usePermisos } from '@/permisos/use-permisos';
import { useNetworkContext } from '@/components/providers/network-provider';
import { useContarAlertas } from '@/hooks/use-alertas';
import { FontSize, FontWeight, Spacing, scale } from '@/constants/theme';
import { useResponsiveColumns } from '@/hooks/use-responsive';

function SectionTitle({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        styles.sectionTitle,
        { color: colors.textSecondary, backgroundColor: colors.background },
      ]}
    >
      {title}
    </Text>
  );
}

function AlertasRow({ module }: { module: ModuloItem }) {
  const { data: noLeidas } = useContarAlertas();
  return <ModuleRow module={module} badge={noLeidas} />;
}

export default function MasScreen() {
  const { colors } = useTheme();
  const { moduloHabilitado, tienePermiso } = usePermisos();
  const { pendingCount } = useNetworkContext();
  const { columns } = useResponsiveColumns();
  const [query, setQuery] = useState('');

  const modulosVisibles = useMemo(() => {
    return MODULOS.filter((m) => {
      const moduloOk = m.modulo ? moduloHabilitado(m.modulo) : true;
      const permisoOk = m.permiso ? tienePermiso(m.permiso) : true;
      return moduloOk && permisoOk;
    });
  }, [moduloHabilitado, tienePermiso]);

  const buscando = query.trim().length > 0;

  const resultados = useMemo(() => {
    if (!buscando) return [];
    return modulosVisibles.filter((m) => filtrarModulo(m, query));
  }, [modulosVisibles, buscando, query]);

  const quickModules = useMemo(
    () => modulosVisibles.filter((m) => m.categoria === 'quick'),
    [modulosVisibles],
  );
  const adminModules = useMemo(
    () => modulosVisibles.filter((m) => m.categoria === 'admin'),
    [modulosVisibles],
  );
  const finanzasModules = useMemo(
    () => modulosVisibles.filter((m) => m.categoria === 'finanzas'),
    [modulosVisibles],
  );

  const cardWidth = columns >= 3 ? '31.5%' : '47%';

  const syncBadge = pendingCount > 0 ? pendingCount : undefined;
  const syncBadgeText = pendingCount > 0 ? `${pendingCount} pendiente${pendingCount > 1 ? 's' : ''}` : 'Al día';

  return (
    <ScreenContainer>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Más</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textTertiary }]}>
            Encuentra aquí todos los módulos de la app
          </Text>
        </View>

        <SearchBar
          value={query}
          onSearch={setQuery}
          placeholder="Buscar módulos..."
        />

        {buscando ? (
          <View style={styles.afterSearch}>
            {resultados.length === 0 ? (
              <EmptyState
                icon="search-outline"
                title="Sin resultados"
                subtitle={`No se encontraron módulos que coincidan con "${query}"`}
              />
            ) : (
              <>
                <Text style={[styles.resultsCount, { color: colors.textTertiary }]}>
                  {resultados.length} resultado{resultados.length > 1 ? 's' : ''}
                </Text>
                {resultados.map((m) => (
                  <ModuleRow key={m.id} module={m} />
                ))}
              </>
            )}
          </View>
        ) : (
          <>
            {quickModules.length > 0 && (
              <View style={styles.section}>
                <SectionTitle title={CATEGORIAS[0].titulo} />
                <View style={styles.grid}>
                  {quickModules.map((m) => (
                    <QuickCard
                      key={m.id}
                      module={m}
                      width={cardWidth}
                      badge={m.id === 'sync' ? syncBadge : undefined}
                      badgeText={m.id === 'sync' ? syncBadgeText : undefined}
                      badgeSuccess={m.id === 'sync' && pendingCount === 0}
                    />
                  ))}
                </View>
              </View>
            )}

            {adminModules.length > 0 && (
              <View style={styles.section}>
                <SectionTitle title={CATEGORIAS[1].titulo} />
                {adminModules.map((m) =>
                  m.id === 'alertas' ? (
                    <AlertasRow key={m.id} module={m} />
                  ) : (
                    <ModuleRow key={m.id} module={m} />
                  ),
                )}
              </View>
            )}

            {finanzasModules.length > 0 && (
              <View style={styles.section}>
                <SectionTitle title={CATEGORIAS[2].titulo} />
                {finanzasModules.map((m) => (
                  <ModuleRow key={m.id} module={m} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: scale(40),
  },
  hero: {
    marginBottom: Spacing.sm,
  },
  heroTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  heroSubtitle: {
    fontSize: FontSize.sm,
    marginTop: scale(2),
    marginBottom: Spacing.sm,
  },
  afterSearch: {
    marginTop: Spacing.md,
  },
  resultsCount: {
    fontSize: FontSize.xs,
    marginBottom: Spacing.sm,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: scale(1),
    marginBottom: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(12),
  },
});