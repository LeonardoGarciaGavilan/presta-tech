# Certificación modo offline — Plan de trabajo guía (checklist vivo)

Regla de oro: NO romper nada que funcione. Cambios aditivos; no alterar el shape de
`CambiosSyncResponse` (los campos nuevos son opcionales) ni la cola offline ni la API online.

Baseline:
- Backend: tsc limpio, 9 suites / 69 tests verdes.
- Mobile: 211 tests / 21 suites verdes; tsc 10 errores (8 en __tests__, 2 reales).

---

## Fase 0 — Preparación
- [x] Crear este archivo-guía y registrar baseline
- [ ] `git status` limpio del trabajo de certificación (branch feature)
- [x] Correr baseline completo (backend + mobile) y anotar resultado

## Fase 1 — Críticos: caja offline (C1 + C2) — afecta dinero
### C1 — Unificar clave react-query de caja
- [x] `src/hooks/use-caja.ts`: `useCajaActiva` con `queryKey: ['caja','activa']` fijo (queryFn conserva `fecha` para el server)
- [x] Verificar pantallas: `caja/index.tsx:40`, `caja/pago.tsx:37,94` (comparten clave fija)
- [x] Verificar `assertCajaAbiertaOffline` (use-pagos.ts:26) y `assertNoCajaAbiertaOffline` (use-caja.ts:27) (prefijo `['caja','activa']` ya cubre)
- [x] Test: arranque en frío offline ve caja sembrada por `hydrateFromDb` (`use-caja.test.ts`, C1)
### C2 — Sincronizar `caja_activa` post-sync
- [x] `sync-manager.ts`: POST `/caja/abrir` → `saveCajaActiva(serverData)`; PATCH `/caja/:id/cerrar` → `saveCajaActiva(null)` (matcheo por regex sobre endpoint crudo)
- [x] Test: `processItem` caja abrir/cerrar actualiza DB (3 casos en `sync-manager.test.ts`)
- [x] Verificar reemplazo tempId→id real en cache (sync-manager.ts:221-263) (no toca; sin queryClient no aplica)
- [x] FASE 1 COMPLETA: tsc (10 baseline, sin nuevos) + jest (215 verdes) + lint (0 errores)

## Fase 2 — Altos: consistencia (C3 + C4 + C5)
### C3 — Rollback en fallo permanente
- [x] `schema.ts` + `provider.tsx`: SCHEMA_VERSION 4, `ALTER TABLE offline_queue ADD COLUMN snapshot TEXT` (try/catch tolerante)
- [x] `offline-queue-db.ts`: guardar/parsear `snapshot`, `restoreSnapshot(item)`
- [x] `use-pagos.ts` (78, 183): snapshot del préstamo antes de `aplicarPagoLocal`/`saldarPrestamoLocal`
- [x] `sync-manager.ts` catch permanente (~359): restaurar snapshot + limpiar entidades sintéticas
- [x] `clearFailedItems`: restaurar snapshot antes de borrar
- [x] Tests: restore en prestamos-db (saldo revertido) + offline-queue-db (restoreSnapshot/clearFailedItems/markStaleAsFailed) + sync-manager (fallo permanente restaura, reintentable no)
### C4 — Purgar SQLite al cerrar sesión
- [x] `session.ts` `clearSession`: purgar 10 tablas con try/catch (`db/purge.ts` nuevo: offline_queue, caja_activa, clientes, prestamos+cuotas, pagos, rutas+ruta_clientes, configuracion, sync_meta)
- [x] Cubrir logout manual + auth-version-sync (clearSession usada por refresh-manager y use-auth-bootstrap)
- [x] Test: clearSession purga DB (`utils/__tests__/session.test.ts`: purge + tokens + clearUser; tolerante a fallo de purge)
### C5 — Falso online
- [x] `use-network-status.ts:62`: `isOnline = isConnected && isInternetReachable !== false`
- [x] Test: mapeo estados NetInfo (`hooks/__tests__/use-network-status.test.ts`: online, reachable null → online, reachable false → offline, desconectado)
- [x] FASE 2 COMPLETA: tsc 5 (3 __tests__ + 2 reales, mejora desde 10 gracias a tipado de prestamos-db.test.ts) + jest 228 verdes / 23 suites + lint (0 errores)

## Fase 3 — Backend (C7)
- [x] C7a: doble pago completo concurrente → replay (no 400) si hay idempotencyKey existente (`ejecutarTxConIdempotencia` ahora captura P2002 Y el BadRequest de "estado ya aplicado" bajo el lock)
- [x] C7b: lock + revalidación de CajaSesion en tx de registrarPago/saldarPrestamo (relectura `cajaSesion.findFirst {id, ABIERTA}` tras el FOR UPDATE)
- [x] C7c: excedente cubre mora→interés→capital de cuotas futuras; `nuevoMonto` incluye `cuota.mora` (ya no "regala" interés+mora marcando pagada)
- [x] C7d: replay de saldo devuelve `cuota: null` (detección: observacion 'Saldo total del préstamo' o >1 cuota con fechaPago cercana al pago)
- [x] Tests en `pagos.service.spec.ts` (4 casos C7 añadidos; `buildTx`/`cuotaPendiente` subidos a scope de módulo)
- [x] FASE 3 COMPLETA: tsc 0 + 9 suites / 73 tests (69 baseline + 4) sin regresiones

## Fase 4 — Propagación de borrados/reasignación (C8)
- [x] Soft-delete rutaCliente + delta incluye `eliminado: true`; mobile filtra al leer
  - Backend: `RutaCliente.eliminado` en schema + migración `20260815000000_add_rutacliente_eliminado` (SQL manual) + `prisma generate`
  - `rutas.service.ts`: `quitarCliente` y `asignarRuta` pasan a soft-delete (update `eliminado:true`); `agregarCliente`/`asignarRuta` reactivan la fila existente (findUnique `rutaId_clienteId`) en vez de create (evita P2002); lecturas excluyen `eliminado:false` (`findAll`, `findOne`, `vistaDia` count+findMany, `marcarVisitado`, `resetVisitados`, `generarRutaDia`, `getRutaDeCliente`)
  - `sync.service.ts`: delta `rutaClientes` incluye los soft-eliminados (sin filtro); include anidado `rutas.clientes` filtra `eliminado:false`
- [x] `rutasAjenas` en delta para no-admin (rutas updatedAt>desde con usuarioId !== me); mobile las retira de cache/SQLite
  - `sync.service.ts`: para no-admin + permisos.rutas consulta rutas ajenas (select `{id}`) y devuelve `rutasAjenas: string[]` (aditivo en `CambiosResult`)
  - Mobile: `deleteRutas(ids)` nuevo en `rutas-db.ts` (borra ruta + rutaClientes por ruta_id); `persistCambios` retira de SQLite y del cache `['rutas']` de react-query (con queryClient) y removeQueries de `['rutas', id, ...]`; `prefetchIncremental`/`forceReloadAll` aceptan queryClient opcional
- [x] Mobile filtra al leer: `rutas-db.ts` (`getRutaClientes`, `getRutaClienteById`, `getRutaClienteByClienteId`, `rowToRutaCliente`/`rutaClienteToRow` con `eliminado`), `clientes-db.ts` (join ruta del cliente), `data-sync.ts` (`syncRutasToDb` mapea `eliminado`)
- [x] DB v5: columna `eliminado` en CREATE TABLE + migración ALTER tolerante en `provider.tsx` (patrón table_info)
- [x] Tests: `sync.service.spec.ts` (5 casos C8: delta sin filtrar eliminado, passthrough eliminado:true, include anidado excluye, rutasAjenas no-admin con cursor, admin vacío) + `rutas-db.test.ts` (7 casos: mapeo, filtrado al leer, re-agregado, deleteRutas) + `prefetch-manager.test.ts` (3 casos: deleteRutas desde SQLite, no-op sin ajenas, cache react-query con queryClient). Mock de rutas-db.test ahora evalúa condiciones SQL (`and(eq,eq)`/`eq` con nombres de columna snake_case→camelCase)
- [x] FASE 4 COMPLETA: Backend tsc 0 + 9 suites / 78 tests (73 + 5 C8); Mobile tsc (5 baseline sin nuevos) + 238 tests / 23 suites (228 + 10 C8)

## Fase 5 — Cobertura de tests y deuda técnica
- [x] Tests directos `aplicarPagoLocal`/`saldarPrestamoLocal`
  - `prestamos-db.test.ts`: +7 (5 `aplicarPagoLocal`: completa/parcial/mora→interés→capital/excedente a cuota siguiente/sin pendientes; 2 `saldarPrestamoLocal`: saldo 0 + cuotas pagadas, no-op si no existe)
- [x] Tests de migración `onInit` (v1/v2)
  - Lógica extraída a `mobile/src/db/migrations.ts` (`initializeDatabase` + `SCHEMA_VERSION`); `provider.tsx` solo delega
  - `migrations.test.ts`: 9 casos (v0 fresh create + índices + user_version, v1/v2/v3/v4→v5, early return v5, columna ya existe sin ALTER, fallo NO-fatal con warn que continúa a user_version)
- [x] Tests: `getQueueStats`, `getQueueItemsReferencingTempId`, `updateQueueItem`, `recoverSyncingItems`
  - Mock de `offline-queue-db.test.ts` reescrito para evaluar condiciones SQL reales de drizzle (eq/like/lte/ne/and/or/inArray con nodos `queryChunks` y `{name}`), incl. `groupBy` con conteo por status e `inArray` en delete
  - 9 tests nuevos: getQueueStats (vacía + conteos con oldestAt), getQueueItemsReferencingTempId (no-op vacío + match por data + por endpoint), updateQueueItem (campos + no-op), recoverSyncingItems (recover + 0 sin syncing)
- [x] Fix typecheck reales: `use-clientes.ts:88` (observaciones), `use-prestamos.ts:266` (esOffline)
- [x] C6: fallback offline historial pagos (`usePagosDePrestamo`→`getPagosByPrestamoId`, `useTodosPagos`→nuevo `getAllPagos`) + `setQueryData` de pago offline en `['pagos','todos']`
  - `use-pagos.ts`: `usePagosDePrestamo`/`useTodosPagos` con try/catch → si `!getNetworkStatus().isOnline` y hay datos locales, devuelven historial local; pago offline hace `setQueryData` en `['pagos','prestamo',id]` y `['pagos','todos']`
  - `pagos-db.ts`: nuevo `getAllPagos()`
  - Tests: `use-pagos.test.ts` (7 C6: fallback de prestamo y de todos + setQueryData del cache; mock de `use-network-status` y `getPagosByPrestamoId`/`getAllPagos` añadidos) + `pagos-db.test.ts` (2 C6 + fix del mock con `orderBy`, suite estaba roja)
- [x] Limpieza: `waitForOnline`, persister react-query, `enableChangeListener`
  - `waitForOnline` eliminado de `use-network-status.ts` (dead code: sin referencias en src/tests)
  - `enableChangeListener: true` eliminado de `openDatabaseSync` en `db/index.ts` (sin `onDatabaseChange` consumidor en el repo)
  - Persister de react-query: verificado ausente en todo el repo (nada que quitar)
- [x] FASE 5 COMPLETA: tsc 0 en src/ + jest + lint

## Fase 6 — Verificación final + matriz QA
- [x] Backend: `npx tsc --noEmit` 0 + `npm test`
  - tsc 0; 9 suites / 78 tests en verde (incl. 11 de `sync.service.spec.ts` con C8)
- [x] Mobile: `npx tsc --noEmit` 0 en src/ + `npm test` + `npm run lint`
  - tsc 0; 271 tests / 24 suites en verde (baseline 238/23 + 33 nuevos F5); `npx expo lint` 0 errores (233 warnings preexistentes)
- [x] Redactar `GUIA_CERTIFICACION_OFFLINE.md` con matriz de QA manual:
  - 17 casos (M1–M17): cobro offline parcial/completo/excedente; saldo total offline
  - caja abrir/cerrar offline; arranque en frío offline
  - kill de app con item syncing (recover + idempotencia); doble pago
  - pago fallido → limpiar fallidos (rollback); cambio de usuario (purga)
  - reconexión con delta; "Forzar recarga"; desactivaciones/borrados (C8 rutasAjenas)
  - pagos transferencia/tarjeta offline; estado financiero offline
- [x] Cierre: acta de certificación (hallazgos resueltos, pendientes, riesgos aceptados)
  - Hallazgos resueltos en esta certificación: suite `pagos-db.test.ts` roja por mock sin `orderBy` (arreglado); `offline-queue-db.test.ts` con mock que no filtraba condiciones SQL (reescrito evaluando nodos de drizzle); tsc mobile con 5 errores (3 en `__tests__` + 2 reales) → 0; dead code (`waitForOnline`, `enableChangeListener`) eliminado
  - Pendientes / riesgos aceptados: 233 warnings de lint preexistentes (sin errores); QA manual M1–M17 queda pendiente de ejecución física en dispositivo (matriz en `GUIA_CERTIFICACION_OFFLINE.md`)
