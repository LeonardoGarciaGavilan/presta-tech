# Plan: Swap inteligente Perfil → Configuración (App Móvil)

> **Fecha:** 2026-08-21
> **Objetivo:** Reemplazar el tab fijo "Perfil" por "Configuración" (solo admins con
> `configuracion:editar`) y reubicar el acceso a Perfil como avatar en el header,
> accesible para todos los usuarios (incluye empleados).

## Decisión de diseño

| Antes | Después |
|---|---|
| 👤 Perfil = tab fijo (todos) | ⚙️ Configuración = tab condicional (solo `configuracion:editar`) |
| ⚙️ Configuración enterrada al final del drawer | 👤 Perfil = avatar en header → `/perfil` (todos, 1 tap) |

## Checklist de progreso

- [x] **1. Mover pantalla**
  `mobile/app/(app)/(drawer)/admin/configuracion.tsx` → `(tabs)/configuracion.tsx`
  (sin cambios de contenido; su gate interno en L153 se mantiene)

- [x] **2. Permisos** — `mobile/src/permisos/permisos.ts`
  - [x] L77: `'admin/configuracion'` → `'(tabs)/configuracion'` (MODULO_POR_PANTALLA)
  - [x] L99: `'admin/configuracion'` → `'(tabs)/configuracion'` (PERMISO_POR_PANTALLA)

- [x] **3. Tab bar** — `mobile/app/(app)/(drawer)/(tabs)/_layout.tsx`
  - [x] `<Tabs.Screen name="perfil">` → `options={{ href: null }}` (ruta viva para el avatar)
  - [x] Agregar tab `configuracion` condicional (`moduloHabilitado('CONFIGURACION') && tienePermiso('configuracion:editar')`), icono `settings-outline`, última posición

- [x] **4. Drawer** — `mobile/app/(app)/(drawer)/_layout.tsx`
  - [x] Quitar entrada de `adminItems` (L110)
  - [x] Quitar `<Drawer.Screen name="admin/configuracion">` (L371-380)

- [x] **5. Header** — `mobile/src/components/ui/company-header.tsx`
  - [x] Quitar `'admin/configuracion'` de `pantallasAdmin` (L30)
  - [x] Agregar avatar con inicial del usuario → `router.push('/(drawer)/(tabs)/perfil')`,
        visible para todos, `accessibilityLabel="Mi perfil"`, hitSlop 10

- [x] **6. Rutas** — `mobile/src/constants/routes.ts` (limpieza)
  - [x] Eliminar `ADMIN.CONFIGURACION`
  - [x] Eliminar stale `TABS.CONFIGURACION: '/perfil/configuracion'`

- [x] **7. Verificación**
  - [x] `npx tsc --noEmit` sin errores
  - [x] ESLint sin errores en archivos tocados
  - [x] Matriz manual documentada (ver abajo)

## Matriz de prueba manual

| Rol | Esperado |
|---|---|
| Admin con permiso | 6º tab ⚙️ visible · avatar visible · drawer SIN Configuración |
| Empleado sin permiso | Sin tab ⚙️ · avatar visible (acceso a su perfil/contraseña) · sin hamburguesa |
| Cualquiera | Tap avatar → pantalla Perfil funciona |

## Resultado por rol

| Rol | Tabs | Perfil | Configuración |
|---|---|---|---|
| Admin | Dash · Caja · Prést · Rutas · Clientes · ⚙️ | Avatar (1 tap) | Tab (1 tap) ✅ |
| Empleado | según módulos (≤5) | Avatar (1 tap) ✅ | Oculto (correcto) |

## Registro de ejecución — 2026-08-21 ✅ COMPLETADO

| Paso | Estado | Notas |
|---|---|---|
| 1. Mover pantalla | ✅ | `git mv` sin cambios de contenido |
| 2. Permisos | ✅ | Clave `'(tabs)/configuracion'` en ambos mapas |
| 3. Tab bar | ✅ | `perfil` con `href: null` · tab `configuracion` condicional |
| 4. Drawer | ✅ | Entrada y Screen registration eliminadas |
| 5. Header | ✅ | Avatar 34px → `Routes.TABS.PERFIL` (todos los roles) |
| 6. Rutas | ✅ | `ADMIN.CONFIGURACION` y stale eliminados |

**Verificación:**
- ✅ `npx tsc --noEmit` → 0 errores
- ✅ ESLint → 0 errores (6 warnings preexistentes, no introducidos)
- ✅ Jest `permisos.test.ts` → 8/8 passed
- ✅ `grep admin/configuracion` → sin referencias huérfanas

**Pendiente manual (requiere dispositivo/emulador):**
- [ ] Admin: verificar 6º tab ⚙️ + avatar visible + drawer sin Configuración
- [ ] Empleado: verificar ≤5 tabs + avatar funcional + sin tab ⚙️

---

# 🔄 Ronda 2 — Corrección leak de tabs + título (2026-08-21) ✅ COMPLETADO

## Bug reportado
Un usuario sin `configuracion:editar` veía el tab ⚙️ y al tocarlo recibía "Sin acceso".

## Causa raíz
Expo Router **auto-registra** cada archivo de `(tabs)/` como tab desde el filesystem.
`<Tabs.Screen>` solo aporta opciones: renderizarlo condicionalmente NO elimina la ruta —
el tab quedaba visible con opciones por defecto. La forma correcta de ocultar es
`href: null`. Defecto latente compartido por los 4 tabs condicionales preexistentes
(caja, préstamos, rutas, clientes); se notó recién con Configuración porque es el primer
permiso que un empleado común nunca tiene.

## Checklist Ronda 2

- [x] **1. `(tabs)/_layout.tsx`** — Los 5 tabs condicionales → registro incondicional
      con visibilidad `href`: caja, prestamos, rutas, clientes, configuracion.
      Booleans calculados una vez (`puedeCaja`, `puedePrestamos`, `puedeRutas`,
      `puedeClientes`, `puedeConfigurar`). Listeners de Caja intactos.
- [x] **2. `(tabs)/configuracion.tsx`** — Bloque de título "Configuración /
      Parámetros operativos del sistema" (patrón de caja/index.tsx), con
      `accessibilityRole="header"`.

## Verificación Ronda 2
- ✅ `npx tsc --noEmit` → 0 errores (tras corregir `null as const` → `null`)
- ✅ ESLint → 0 errores (4 warnings preexistentes)
- ✅ Jest `permisos.test.ts` → 8/8 passed

## Pendiente manual (dispositivo/emulador)
- [ ] Empleado sin permiso: tab bar SIN ⚙️ ni tabs fantasma; tap imposible
- [ ] Admin: 6º tab ⚙️ visible con título "Configuración" en pantalla
