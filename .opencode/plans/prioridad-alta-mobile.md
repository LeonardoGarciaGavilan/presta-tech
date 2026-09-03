# Plan: Prioridad Alta — PrestaTech Mobile

## Resumen
Implementar las 3 mejoras de prioridad alta identificadas en el análisis de brechas: Fix Dark Mode, React.memo en componentes de lista, y reducir `as any`.

---

## TAREA 1: Fix Dark Mode

### 1.1 `src/components/auth/auth-guard.tsx`
- **Problema:** Líneas 20 y 41 usan `Colors.light` hardcodeado
- **Fix:** Importar `useTheme`, usar `colors.primary` y `colors.background`
- **Eliminar:** Import de `Colors` (ya no se usa)

### 1.2 `src/components/dashboard/quick-actions.tsx`
- **Problema:** Líneas 16-21, `ACTIONS` tiene colores hardcodeados de light mode
- **Fix:** Mover `ACTIONS` dentro del componente, reemplazar por tokens del tema:
  - `'#16A34A'` → `colors.success`, `'#F0FDF4'` → `colors.successLight`
  - `'#2563EB'` → `colors.primary`, `'#EFF6FF'` → `colors.primaryLight`
  - `'#D97706'` → `colors.warning`, `'#FFFBEB'` → `colors.warningLight`
  - `'#0891B2'` → `colors.route`, `'#ECFEFF'` → `colors.routeBg`

---

## TAREA 2: React.memo en Componentes de Lista

### 2.1 `src/components/clientes/cliente-card.tsx` — MAYOR PRIORIDAD
- Se renderiza en FlatList (`clientes/index.tsx:99-114`)
- Recibe 5 props
- **Fix:** `export default React.memo(ClienteCard)` + `displayName`

### 2.2 `src/components/clientes/prestamo-card.tsx`
- Se renderiza en `.map()` (`clientes/[id].tsx:536`, `estado-cuenta.tsx:87`)
- Recibe 2 props
- **Fix:** `export default React.memo(PrestamoCard)` + `displayName`

### 2.3 `src/components/clientes/kpi-card.tsx`
- Se renderiza en grid
- Recibe 4 props
- **Fix:** `export default React.memo(KpiCard)` + `displayName`

### 2.4 `src/components/clientes/cliente-avatar.tsx`
- Se renderiza dentro de `ClienteCard`
- Recibe 3 props
- **Fix:** `export default React.memo(ClienteAvatar)` + `displayName`

### 2.5 Extraer `ClienteCardItem` en `app/(app)/(drawer)/(tabs)/rutas/[id].tsx`
- Línea 531: función inline renderizada en `.map()` línea 359
- Recibe 6 props incluyendo callbacks
- **Fix:** Extraer a componente externo, envolver con `React.memo`, usar `useCallback` en callbacks del padre

### 2.6 Extraer `CuotaBadge` en `app/(app)/(drawer)/(tabs)/prestamos/[id].tsx`
- Línea 154: función inline renderizada en `.map()` línea 568
- Recibe 2 boolean props
- **Fix:** Extraer a componente, envolver con `React.memo`

### 2.7 Extraer `InfoItem` en `app/(app)/(drawer)/(tabs)/prestamos/[id].tsx`
- Línea 141: función inline renderizada múltiples veces
- Recibe 2 string props
- **Fix:** Extraer a componente, envolver con `React.memo`

---

## TAREA 3: Reducir `as any`

### 3.1 StyleSheet `as any` (~96 instancias)
**Archivos:** `detalle-sesion-modal.tsx`, `caja/index.tsx`, `caja/pago.tsx`, `caja/historial.tsx`, `caja/activas.tsx`, `pagos/index.tsx`, `pagos/prestamo/[id].tsx`

**Causa:** Constantes personalizadas (`Spacing.md`, `BorderRadius.lg`) no compatibles con tipos de `StyleSheet.create`.

**Solución:** Crear tipo helper `AppStyles` en `src/constants/theme.ts`:
```typescript
export type AppStyles = Record<string, any>;
```
Reemplazar `} as any` por `} as AppStyles` en todos los archivos.

### 3.2 Icon type casting (6 instancias)
**Archivos:** `action-confirm-modal.tsx:58`, `toast.tsx:108`, `prestamo-card.tsx:70`, `payment-form.tsx:300`, `prestamos/[id].tsx:320`, `clientes/estado-cuenta.tsx:384`

**Solución:** Crear tipo `IoniconsName` en `src/constants/theme.ts`:
```typescript
import { Ionicons } from '@expo/vector-icons';
export type IoniconsName = keyof typeof Ionicons.glyphMap;
```
Reemplazar `as any` por `as IoniconsName`.

### 3.3 Dynamic theme color access (4 instancias)
**Archivos:** `kpi-card.tsx:70,76`, `clientes/estado-cuenta.tsx:223,224`

**Solución:** Crear helper en `src/constants/theme.ts`:
```typescript
export function getColor(colors: typeof Colors.light, key: string): string {
  return (colors as Record<string, string>)[key] ?? colors.text;
}
```

### 3.4 Route navigation (1 instancia)
**Archivo:** `quick-actions.tsx:35`

**Solución:** Cambiar `router.push(action.route as any)` por `router.push(action.route as any)` → mantener pero agregar comentario `// TODO: Type routes properly`

### 3.5 Error type casting (3 instancias)
**Archivos:** `prestamos/index.tsx:255`, `prestamos/[id].tsx:290`, `clientes/estado-cuenta.tsx:43`

**Solución:** Cambiar `(error as any)?.message` por:
```typescript
(error instanceof Error ? error.message : 'Error desconocido')
```

---

## Orden de Ejecución

| Paso | Tarea | Archivos |
|------|-------|----------|
| 1 | Escribir plan | `.opencode/plans/prioridad-alta-mobile.md` |
| 2 | Fix AuthGuard dark mode | `src/components/auth/auth-guard.tsx` |
| 3 | Fix QuickActions dark mode | `src/components/dashboard/quick-actions.tsx` |
| 4 | Memoizar ClienteCard | `src/components/clientes/cliente-card.tsx` |
| 5 | Memoizar PrestamoCard | `src/components/clientes/prestamo-card.tsx` |
| 6 | Memoizar KpiCard + ClienteAvatar | `src/components/clientes/kpi-card.tsx`, `src/components/clientes/cliente-avatar.tsx` |
| 7 | Extraer ClienteCardItem | `app/(app)/(drawer)/(tabs)/rutas/[id].tsx` |
| 8 | Extraer CuotaBadge + InfoItem | `app/(app)/(drawer)/(tabs)/prestamos/[id].tsx` |
| 9 | Crear tipos helper | `src/constants/theme.ts` |
| 10 | Fix StyleSheet as any | 7 archivos caja/pagos |
| 11 | Fix icon as any | 6 archivos |
| 12 | Fix dynamic color as any | 2 archivos |
| 13 | Fix route + error as any | 2 archivos |
| 14 | Verificar lint + tipos + tests | Global |

## Verificación
- `npx expo lint` — sin errores
- `npx tsc --noEmit` — sin errores de tipo
- `npm test` — tests existentes pasan
