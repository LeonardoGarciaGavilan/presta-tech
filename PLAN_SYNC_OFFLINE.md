# Plan: Sincronización offline híbrida (auto-incremental + botón full real)

Estrategia elegida con el usuario: **híbrido**. Con <100 usuarios:
- Descarga **automática por deltas** (solo lo que cambió) en boot/foreground/reconnect.
- Botón **"Forzar recarga"** hace una descarga **completa real** (único full bajo demanda).

Regla de oro para NO romper lo que ya funciona: todo lo que hoy funciona online y
offline debe seguir igual (push de cola offline, reconciliación local, hydrate desde
SQLite). El cambio solo introduce un nuevo endpoint de descarga y nuevos disparadores.

---

## Estado (checklist)

- [x] **Fase 1 — Backend: endpoint incremental `GET /sync/cambios`**
  - [x] Migración Prisma: `updatedAt` en `Prestamo` y `RutaCliente` (con trigger PG + backfill + índices)
  - [x] `SyncService.cambios(empresaId, rol, usuarioId, desde?)` (delta o snapshot completo)
  - [x] Ruta en `SyncController` con mismos guards de auth/roles
  - [x] Migración aplicada en Supabase (`prisma migrate deploy`, 24/24 migraciones OK)
- [x] **Fase 2 — Mobile: descarga por deltas + botón full real**
  - [x] `getCambios(desde?)` en `src/api/sync.api.ts`
  - [x] Cursor separado (`syncCursor` = serverTime) en `sync-meta-db.ts`
  - [x] `prefetch-manager.ts`: `prefetchIncremental`, `forceReloadAll` (sustituye el paginado 200/200)
  - [x] `sincronizacion.tsx`: `handleForceReload` → `forceReloadAll` (sin `invalidateQueries` global)
- [x] **Fase 3 — Disparadores**
  - [x] Conectar `prefetchOnReconnect` en `network-provider.tsx`
  - [x] `use-background-prefetch.ts`: prefetch también al montar (no solo foreground)
- [x] **Verificación** (build + tests backend + typecheck/tests mobile)

### Fix aplicado (post-revisión offline/online)
- **Bug**: préstamos con saldo 0 en SQLite → no se podía cobrar offline (caja ni rutas).
  - Causa: `GET /sync/cambios` devolvía `saldoPendiente`/`moraAcumulada` de la columna
    (que NO es fuente de verdad; solo se escribe en algunos flujos). `listar`/`findOne`
    las calculan desde cuotas con `calcularDesdeObjeto` (`common/utils/prestamo.utils.ts`).
  - Fix: `sync.service.ts` ahora mapea los préstamos con `calcularDesdeObjeto` (igual que
    `prestamos.listar`). Aplica a snapshot completo y deltas.
  - Test: `src/sync/sync.service.spec.ts` (saldo/mora calculados + filtro delta).
  - **Operativo**: tras desplegar, pulsar "Forzar recarga" en cada dispositivo para que el
    snapshot completo re-publique los saldos (los deltas solo traen préstamos con
    `updatedAt > cursor`).

---

## Decisiones de diseño (para no perder contexto)

### Cursor / gate
- `lastSyncAt` (local) = **gate** de frecuencia (30 min) para `shouldPrefetch()`.
- `syncCursor` (nuevo, = `serverTime` del servidor) = **cursor** de datos. Separados
  para que el reloj local del dispositivo no cause re-descargas ni pierda cambios.

### Deltas por entidad (qué responde el backend)
- `clientes` → `updatedAt > desde` (solo `activo: true`, paridad con `listarClientes`).
- `prestamos` → `updatedAt > desde` con `include: { cliente, garante, cuotas, pagos }`.
  Un pago hace `prestamo.update` → bumps `updatedAt` → el delta trae cuotas actualizadas
  y el historial de pagos anidado (sin query extra de pagos).
- `rutas` → `updatedAt > desde` con `clientes` (rutaClientes). Filtro `usuarioId` si no es ADMIN
  (paridad con `rutas.findAll`).
- `rutaClientes` → `updatedAt > desde` (filtrado por las rutas de la empresa). Captura
  `visitadoHoy`/`ultimaVisita` que cambian sin tocar la fila de la ruta.
- `configuracion` → siempre (es chica, con `existe`).
- `serverTime` → nuevo cursor.

### `updatedAt` en Prestamo/RutaCliente
Solo `Cliente` y `Ruta` tienen `updatedAt` hoy. Se agrega a `Prestamo` y `RutaCliente`.
El trigger de PostgreSQL es necesario porque el cron de mora usa `updateMany`
(`prestamos.service.ts:1237,1247`), que no dispara `@updatedAt` de Prisma.
`Cuota`/`Pago` NO necesitan `updatedAt` (cuotas van anidadas en el préstamo; pagos son append-only).

### Mobile: no hace falta migrar SQLite
El cursor es global (`sync_meta`), no por fila. `upsertClientes/Prestamos/Rutas/...`
ya existen. `upsertPrestamos` ya persiste cuotas anidadas.

### Riesgo conocido (pre-existente, no empeorar)
- Clientes desactivados no se propagan a dispositivos (mismo comportamiento que hoy:
  `listarClientes` solo devuelve `activo: true`).
- No paginación en el snapshot completo (para <100 usuarios es aceptable; ver futuro).

### Futuras mejoras (fuera de alcance)
- Paginación del delta con cursor por entidad.
- Compresión/gzip y ETags.
- Descargar solo rutas asignadas + vistaDia bajo demanda.
