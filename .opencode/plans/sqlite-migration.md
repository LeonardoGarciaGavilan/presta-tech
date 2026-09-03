# Plan: Migración a SQLite + Corrección de 5 Bugs Críticos

## Contexto

El sistema actual de offline (React Query cache + AsyncStorage + índices en memoria) falla en producción por 5 razones críticas:
1. Búsquedas de clientes no funcionan offline (índices vacíos por lz-string migration)
2. Módulo de rutas muestra error aunque tenga datos cacheados (`if (error)` antes que `data`)
3. Pagos no funcionan offline (no hay datos individuales de préstamos en caché)
4. App cierra sesión sin internet (`waitForRefresh()` falla → `isAuthenticated` queda false)
5. Cola offline se pierde al cerrar (`readRawQueue()` retorna `[]` silenciosamente)

**Decisión:** Migrar a SQLite como fuente de verdad offline, reemplazando AsyncStorage para datos y cola offline.

---

## Fase 1: Infraestructura SQLite

### 1.1 Instalar dependencias
```bash
cd mobile
npx expo install expo-sqlite
npm install drizzle-orm
npm install -D drizzle-kit
```

### 1.2 Configurar app.json — plugin expo-sqlite
Agregar plugin con `enableFTS: true` para búsquedas de texto completo.

### 1.3 Configurar babel.config.js — inline-import para .sql
Agregar plugin `inline-import` para que Metro pueda importar archivos .sql de migraciones.

### 1.4 Crear drizzle.config.ts

### 1.5 Crear schema — `mobile/src/db/schema.ts`
Tablas: clientes, prestamos, cuotas, pagos, rutas, ruta_clientes, configuracion, offline_queue, sync_meta

### 1.6 Generar migraciones con `npx drizzle-kit generate`

### 1.7 Crear DatabaseProvider — `mobile/src/db/provider.tsx`

### 1.8 Crear database singleton — `mobile/src/db/index.ts`

---

## Fase 2: Servicios de Datos

### 2.1 `mobile/src/db/clientes-db.ts` — CRUD clientes en SQLite
### 2.2 `mobile/src/db/prestamos-db.ts` — CRUD préstamos en SQLite
### 2.3 `mobile/src/db/cuotas-db.ts` — CRUD cuotas en SQLite
### 2.4 `mobile/src/db/pagos-db.ts` — CRUD pagos en SQLite
### 2.5 `mobile/src/db/rutas-db.ts` — CRUD rutas en SQLite
### 2.6 `mobile/src/db/config-db.ts` — CRUD configuración en SQLite
### 2.7 `mobile/src/db/offline-queue-db.ts` — Cola offline en SQLite (reemplaza offline-queue.ts)
### 2.8 `mobile/src/db/sync-meta-db.ts` — Metadata de sincronización

---

## Fase 3: Capa de Sincronización

### 3.1 `mobile/src/services/data-sync.ts` — Orquestador API ↔ SQLite
### 3.2 Actualizar `prefetch-manager.ts` — Persistir en SQLite después de fetch
### 3.3 Actualizar `sync-manager.ts` — Usar cola SQLite
### 3.4 Actualizar `network-provider.tsx` — Importar de offline-queue-db

---

## Fase 4: Corrección de 5 Bugs Críticos

### 4.1 Auth cierra sesión offline — `use-auth-bootstrap.ts`
Agregar check de conectividad antes de waitForRefresh(); fallback a tokens existentes offline.

### 4.2 Cola offline se pierde — Reemplazada por SQLite (Fase 2.7)

### 4.3 Rutas muestra error con datos cacheados — `rutas/index.tsx`
Cambiar `if (error)` → `if (error && !data)` en 3 archivos.

### 4.4 Búsquedas no funcionan — Reemplazar search-index.ts por SQLite queries

### 4.5 Pagos no funcionan offline — Usar SQLite para datos individuales de préstamos

---

## Fase 5: Actualización de Hooks

### 5.1-5.7 Actualizar use-clientes, use-prestamos, use-rutas, use-pagos, use-caja, use-configuracion
Cada hook: sync a SQLite después de fetch + fallback a SQLite cuando offline

---

## Fase 6: Integración en Layout

### 6.1 Actualizar app/_layout.tsx — DatabaseProvider + SQLite KV store persister

---

## Fase 7: Limpieza

### 7.1 Eliminar search-index.ts y offline-queue.ts
### 7.2 Verificar con `npx tsc --noEmit`

---

## Resumen de Archivos

**Crear (13):** drizzle.config.ts, db/schema.ts, db/index.ts, db/provider.tsx, db/clientes-db.ts, db/prestamos-db.ts, db/cuotas-db.ts, db/pagos-db.ts, db/rutas-db.ts, db/config-db.ts, db/offline-queue-db.ts, db/sync-meta-db.ts, services/data-sync.ts

**Modificar (18):** package.json, app.json, babel.config.js, _layout.tsx, use-auth-bootstrap.ts, use-entity-search.ts, use-clientes.ts, use-prestamos.ts, use-rutas.ts, use-pagos.ts, use-caja.ts, use-configuracion.ts, sync-manager.ts, prefetch-manager.ts, network-provider.tsx, rutas/index.tsx, rutas/[id].tsx, rutas/gestion/[id].tsx

**Eliminar (2):** search-index.ts, offline-queue.ts
