# Plan: Fix Scroll Modal Auditoría + Mejoras

**Archivo principal:** `mobile/app/(app)/(drawer)/admin/auditoria.tsx`

---

## Cambio 1: Fix Crítico del Scroll en Modal

### 1a. Reemplazar Pressable interno por View (línea 487-489)

**ANTES:**
```tsx
<Pressable
  style={[styles.modalContent, { backgroundColor: colors.surfaceElevated }]}
  onPress={() => {}}
>
```

**DESPUÉS:**
```tsx
<View
  style={[styles.modalContent, { backgroundColor: colors.surfaceElevated }]}
>
```

**Razón:** El `onPress={() => {}}` vacío intercepta gestos de scroll. Un `View` no interferirá con los gestos táctiles del `ScrollView` hijo.

### 1b. Agregar flex: 1 al estilo modalContent (línea 740-745)

**ANTES:**
```tsx
modalContent: {
  borderTopLeftRadius: BorderRadius.xl,
  borderTopRightRadius: BorderRadius.xl,
  maxHeight: '85%',
  paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.md,
},
```

**DESPUÉS:**
```tsx
modalContent: {
  borderTopLeftRadius: BorderRadius.xl,
  borderTopRightRadius: BorderRadius.xl,
  maxHeight: '85%',
  flex: 1,
  paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.md,
},
```

**Razón:** `flex: 1` asegura que el contenedor ocupe el espacio disponible dentro del overlay, no solo el tamaño del contenido.

### 1c. Agregar contentContainerStyle al ScrollView de DetalleContent (línea 530-534)

**ANTES:**
```tsx
<ScrollView
  keyboardShouldPersistTaps="handled"
  showsVerticalScrollIndicator={false}
  bounces={false}
>
```

**DESPUÉS:**
```tsx
<ScrollView
  keyboardShouldPersistTaps="handled"
  showsVerticalScrollIndicator={false}
  bounces={false}
  nestedScrollEnabled
  contentContainerStyle={{ flexGrow: 1 }}
>
```

**Razón:** `flexGrow: 1` asegura que el contenido scrolleable llene el espacio disponible. `nestedScrollEnabled` mejora compatibilidad en Android con scroll anidado.

---

## Cambio 2: Corregir Hardcoded Colors para Dark Mode

### 2a. Header del modal (línea 756-757)

**ANTES:**
```tsx
header: {
  borderBottomWidth: 1,
  borderBottomColor: '#E5E7EB',
},
```

**DESPUÉS:** Usar estilo inline con `colors.border`:
```tsx
<View style={[detalleStyles.header, { borderBottomColor: colors.border }]}>
```

### 2b. Row del modal (línea 764-765)

**ANTES:**
```tsx
row: {
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: '#E5E7EB',
},
```

**DESPUÉS:** Usar estilo inline con `colors.border`:
```tsx
<View style={[detalleStyles.row, { borderBottomColor: colors.border }]}>
```

---

## Cambio 3: Agregar Accessibility Labels

### 3a. Tarjetas FlatList (línea 222)

```tsx
<TouchableOpacity
  activeOpacity={0.7}
  onPress={() => openDetail(item)}
  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
  accessibilityRole="button"
  accessibilityLabel={`Registro de auditoría: ${item.accion}, tipo ${item.tipo}, ${item.usuario?.nombre || 'sin usuario'}`}
  accessibilityHint="Toca para ver detalles"
>
```

### 3b. Botón cerrar modal (línea 539-541)

```tsx
<TouchableOpacity
  onPress={onClose}
  hitSlop={8}
  accessibilityRole="button"
  accessibilityLabel="Cerrar detalle de auditoría"
>
```

### 3c. Botón expandir User Agent (línea 559-571)

```tsx
<TouchableOpacity
  onPress={() => setShowExtra((p) => !p)}
  style={detalleStyles.expandBtn}
  accessibilityRole="button"
  accessibilityLabel={showExtra ? 'Ocultar User Agent' : 'Ver User Agent'}
  accessibilityState={{ expanded: showExtra }}
>
```

---

## Cambio 4: Mejorar Skeleton Loading

Reemplazar el skeleton actual (línea 271-283) con una versión más completa que incluya chips y KPIs:

```tsx
if (isLoading) {
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Skeleton height={48} style={{ marginBottom: Spacing.md }} />
        <Skeleton height={40} style={{ marginBottom: Spacing.md }} />
        <View style={styles.chipRow}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width={scale(60)} height={scale(28)} borderRadius={BorderRadius.full} />
          ))}
        </View>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height={90} style={{ marginBottom: Spacing.sm }} />
        ))}
      </View>
    </View>
  );
}
```

---

## Cambio 5: Mejorar Mensajes de Error

### 5a. Mensaje de error más específico (línea 456-462)

```tsx
isError ? (
  <EmptyState
    title="Error al cargar auditoría"
    subtitle={
      isError instanceof Error
        ? `${isError.message}`
        : 'No se pudieron obtener los registros. Verifica tu conexión.'
    }
    icon="cloud-offline-outline"
    actionLabel="Reintentar"
    onAction={refetch}
  />
) : (
  <EmptyState
    title="No hay registros de auditoría"
    subtitle={search.trim()
      ? `No se encontraron resultados para "${search}"`
      : 'No se encontraron registros para los filtros seleccionados.'
    }
    ...
  />
)
```

---

## Verificación

Después de implementar, ejecutar:
```bash
cd /Users/leonardogarciagavilan/sas-prestamos/mobile
npx tsc --noEmit  # Verificar tipos
npx expo lint      # Verificar lint (si está configurado)
```

Probar manualmente:
1. Abrir módulo de auditoría
2. Hacer clic en un registro
3. Verificar que el modal se abre y se puede hacer scroll
4. Probar en modo oscuro si está disponible
5. Verificar que los botones de cerrar y expandir funcionan
