# Certificación módulo de préstamos — Plan de trabajo guía (checklist vivo)

Regla de oro: NO romper nada que funcione. Cambios aditivos; mantener verde la línea base.
Estrategia transversal para saldo obsoleto `saldoPendiente`: **calcular desde cuotas** (no escribir el campo, no migrar esquema).

Baseline (verificado antes de empezar):
- Backend: `tsc` 0 errores · 78 tests / 9 suites verdes · eslint ~984 errores preexistentes (no bloquea; limpieza limitada a `prestamos/*` y `pagos/*`).
- Mobile: `tsc` 0 errores · 271 tests / 24 suites verdes · `expo lint` 0 errores.

Fases: 1 (P0) → 2 (P1) → 3 (P2) → 4 (P3) → 5 (Idempotencia online). Marcar con `[x]` cada ítem al completarlo.

---

## Fase 0 — Preparación
- [x] Crear este archivo-guía con baseline y checklist (checklist vivo: marcar avance por ítem).
- [x] Confirmar alcance con el usuario: Todo P0–P3 + idempotencia online obligatoria.
- [x] Confirmar decisión fix 2.8: **solo mobile, respetar backend** (replicar `calcularAmortizacionRapida`, sin tocar reglas de negocio).

## Fase 1 — P0 (afecta dinero/datos)
### 1.1 Saldo pendiente obsoleto en resúmenes (backend)
Auditoría completa de `saldoPendiente` (columna `@default(0)`, NUNCA se escribe; `pagos.service` L687/706/947 solo lo ponen en la respuesta, no en DB). Fuente de verdad correcta: `calcularDesdeObjeto`/`calcularSaldoDesdeCuotas` (`common/utils/prestamo.utils.ts`).
- [x] Confirmado: `prestamos.service.ts:605/881/1586` comentan "NO escribimos saldoPendiente"; `pagos.service` solo lo usa en DTOs de respuesta.
- [x] **Lectura stale → FIX** `dashboard.service.ts:435/465` (`obtenerProximasCuotas`): lee la columna (siempre 0). Calcular por `groupBy` de cuotas pendientes por prestamoId (misma técnica de agregación que L230-236).
- [x] **Lectura stale → FIX** `pagos.service.ts:1024-1036` (`findAll`): devuelve `prestamo.saldoPendiente` de columna (0). Calcular desde cuotas (groupBy) y mapear la respuesta.
- [x] **Lectura stale → FIX** `prestamos.service.ts:1554` (`refinanciar` historial `saldoAntes`): usar `this.calcularDesdeObjeto(prestamo).saldoPendiente` (cuotas ya cargadas L1481).
- [x] **Código muerto → REMOVER** `dashboard.service.ts:345`: select `saldoPendiente: true` (L387 ya calcula real desde cuotas).
- [x] **Código muerto → REMOVER** `capital.service.ts:799-808`: include anidado `cliente.prestamos` (con `saldoPendiente`) nunca se usa en `getResumenRutas` (dineroEnCalle usa `prestamosPorRuta` L818-847 + `calcularSaldoDesdeCuotas` L900).
- [x] **Código muerto → REMOVER** `prestamos.service.ts:1423-1429`: aggregate `_sum: { saldoPendiente }` (L1466 usa `saldoRealTotal` desde cuotas).
- [x] Ya correctos (no tocar): `dashboard-mobile.service.ts:38-39` (SQL desde cuotas), `dashboard.service.ts:230-236`, `pagos.service.ts:1057-1064` (findOne), y todos los `calcularDesdeObjeto`.
- [x] Tests backend (5 nuevos): `dashboard.service.spec.ts` (2: saldo real + sin cuotas), `pagos.service.spec.ts` findAll (2: saldo real + sin pagos), `prestamos.service.spec.ts` refinanciar (1: saldoAntes desde cuotas). tsc 0 · 83 tests / 11 suites.

### 1.2 Excedente en pago offline solo aplica a capital (mobile)
- [x] `prestamos-db.ts:348-368` `aplicarPagoLocal`: replicar orden del backend (`pagos.service.ts:500-572`): excedente cubre mora → interés → capital de cuotas futuras; `nuevoMonto` incluye mora; si monto llega a 0, cuota pagada.
- [x] Tests en `prestamos-db.test.ts`: actualizado test anterior (solo-capital → interés primero) + nuevo caso mora→interés→capital. Suite: 272 tests / 24 suites.

### 1.3 Doble conteo de abono en sync (mobile)
- [x] `sync-manager.ts:313`: `sp.capital + (sp.abonoCapital ?? 0)` duplicaba el excedente: el backend ya define `pago.capital = capitalAplicado + excedente` (`pagos.service.ts:672`) y `abonoCapital = excedente` (L678). Corregido a `capital: sp.capital`.
- [x] Test actualizado (`sync-manager.test.ts`): `capital: 2700` (antes 2750). 22 tests del suite verdes.

### 1.4 Guards `esOffline` faltantes en hooks de préstamo (mobile)
- [x] `use-prestamos.ts:188` (actualizar), `:220` (cancelar), `:305` (desembolsar), `:345` (refinanciar): replicar patrón de `useCambiarEstadoPrestamo` (L266) — guard `esOffline` en `onSuccess` para no escribir `undefined`.
- [x] Optimista `REFINANCIADO` (L339): estado inexistente → corregido a `ACTIVO` (ver 3.2).
- [x] Tests de hooks: `onSuccess` con respuesta offline no rompe cache (4 nuevos en `use-prestamos.test.ts`).

### 1.5 Race pull vs push en sync (mobile)
- [x] `data-sync.ts` + `prefetch-manager.ts`: ordenar pull/push para evitar pisar datos locales recién encolados.
  - `network-provider.tsx` `onOnline`: push (`triggerSync` deduplicado por promesa) ANTES del pull (`prefetchOnReconnect`).
  - `prefetch-manager.ts` `persistCambios`: excluye del upsert préstamos/clientes con mutaciones pendientes (nuevo `getEntitiesWithPendingMutations` en `sync-manager.ts`).
- [x] Test de orden de operaciones (pull no sobrescribe cambios locales pendientes) — 4 nuevos en `prefetch-manager.test.ts`.

- [x] **FASE 1 COMPLETA**: tsc backend 0 + tsc mobile 0 + jest backend (83) / mobile (280, 24 suites) verdes + `expo lint` 0.

## Fase 2 — P1 (consistencia online/offline)
### 2.1 Pago de saldo total no se persiste tras sync
- [x] `sync-manager.ts:300-307`: agregar rama para `/pagos/saldar/:id` (aplicar saldo en local al sincronizar) — el pago del server se persiste en la tabla local igual que `/pagos`.
- [x] Test: saldo total pendiente en cola se aplica al procesarse.

### 2.2 Hidratar tabla `pagos` desde servidor
- [x] `prestamos-db.ts:114-143` `upsertPrestamos` descarta `pagos[]`: persistir pagos del server en `pagos` local.
- [x] Test: `upsertPrestamos` con pagos anidados los guarda.

### 2.3 `markStaleAsFailed` no limpia sintéticos `*_temp_*`
- [x] `offline-queue-db.ts:204-232`: limpiar también los sintéticos `*_temp_*` al marcar stale como failed (helper `limpiarSinteticos`, reutilizado en `clearFailedItems`).
- [x] Test: filas `_temp_` asociadas se eliminan con el item stale.

### 2.4 `createdAt` de cuotas = fecha de vencimiento
- [x] `prestamos-db.ts:131`: usar `new Date()` real (o replicar servidor) en vez de `fechaVencimiento` (`cuota.createdAt ?? now()`, paridad con Prisma).
- [x] Test: `createdAt` de cuota local ≠ `fechaVencimiento` cuando hay diferencia.

### 2.5 Backend: `estado` no editable por `PATCH /prestamos/:id`
- [x] `update-prestamo.dto.ts`: quitado `estado` libre — eliminado el endpoint genérico `PATCH /prestamos/:id` (código muerto en mobile; transiciones solo por endpoints dedicados `:id/estado`, `:id/cancelar`, `:id/desembolsar`, `:id/refinanciar`).
- [x] Test: `prestamos.controller.spec.ts` verifica que no existe `PATCH :id` genérico.

### 2.6 Re-encolado de cobros ante "falso online"
- [x] `use-network-status.ts:65`: cuando `isInternetReachable === null` no marcar online a ciegas (`=== true`).
- [x] `use-pagos.ts`: extracción de helper `encolarPagoOffline` + rama online con `generateIdempotencyKey` → `registrarPago(dto, key)` y re-encolado vía `encolarPagoOffline(..., { validarLocal:false, idempotencyKey:key })` ante `esFalloDeRedOIncierto` (statusCode 0/408/429/5xx). Mismo patrón aplicado a `useSaldarPrestamo`.
- [x] `offline-queue-db.ts`: exportado `generateIdempotencyKey`; `addToQueue` acepta `idempotencyKey` opcional para reutilizar la misma key.
- [x] `pagos.api.ts`: `registrarPago` y `saldarPrestamo` aceptan `idempotencyKey?` y la inyectan en el body (el backend la lee de `dto.idempotencyKey`).
- [x] Tests: 4 tests nuevos (cobro re-enqueue mismo key, 5xx re-enqueue, error 400 NO re-enqueue, saldar re-enqueue mismo key). Suite `use-pagos.test.ts` → 17 tests verdes. Suite completa mobile → **288 tests (24 suites)**.

### 2.7 Tenant scoping en alertas (backend)
- [x] `prestamos.service.ts:1735` `marcarAlertaLeida` sin tenant: agregar scope por tenant.
- [x] Test: alerta de otro tenant no se marca.

### 2.8 🔥 Interés visible en tabla de amortización modo rápido (mobile)
- [x] `use-prestamo-preview.ts`: replicar `calcularAmortizacionRapida` (`prestamos.service.ts:110-231`) como helper local (mismo algoritmo/redondeo) y usarlo en modo rápido **online y offline** (hoy llama `/calcular` con tasa 0 → `interes:0` y `capital=monto/duracion`; los agregados se sobrescriben pero las cuotas no se redistribuyen).
- [x] Resultado: tabla muestra Interés por cuota > 0 y Capital+Interés = Total (coincide con lo que persiste el backend al desembolsar).
- [x] `nuevo.tsx:153-156`: `handleSubmit` ya envía `preview.montoTotal` (derivado del mismo cálculo) → consistente con validación de cuotas enteras.
- [x] Avisar en preview si el total no genera cuotas enteras (comportamiento backend actual; sin tocar reglas de negocio).
- [x] Tests: preview modo rápido PAGO y GANANCIA con/offline; suma cuotas == montoTotal; interes última cuota = resto.

- [x] **FASE 2 COMPLETA**: tsc backend 0 + tsc mobile 0 + jest backend/mobile verdes + `expo lint` 0.

## Fase 3 — P2 (UX y correcciones menores)
- [x] 3.1 Zona horaria RD: usar `getFechaRD()`/`getTodayISO()` (`formatters.ts:104,109`) en pantallas de préstamos/pagos (`nuevo.tsx:62` y otras).
- [x] 3.2 Estado `REFINANCIADO` inexistente → usar `ACTIVO` (`use-prestamos.ts:339,345`).
- [x] 3.3 `routes.ts:16`: `PAGOS_PRESTAMO` apunta a `/pagos/${id}`; corregir a `/pagos/prestamo/[id]`.
- [x] 3.4 `pagos.api.ts`: tipos de retorno + deduplicar `PagoConPrestamo`.
- [x] 3.5 Fallback offline resumen/solicitudes de clientes.
- [x] 3.6 Toasts engañosos offline en `prestamos/index.tsx`, `caja/activas.tsx`, `caja/historial.tsx`.
- [x] 3.7 Placeholders/skeleton offline.
- [x] 3.8 `warnings.tasaAlta` muerto (`nuevo.tsx:501`) → eliminar o implementar.
- [x] 3.9 Error state en historial de pagos.
- [x] 3.10 `safeFetch` respeta `staleTime` (`data-sync.ts:32-62`).
- [x] **FASE 3 COMPLETA**: tsc + jest + lint verdes.

## Fase 4 — P3 (deuda técnica)
- [x] Limpieza de `any` limitada a `prestamos/*` y `pagos/*` (backend) y pantallas `prestamos/*`, `caja/*` (mobile).
- [x] Imports muertos y tipos duplicados.
- [x] Cascadas/borrados huérfanos si aplica.
- [x] **FASE 4 COMPLETA**: tsc + jest + lint verdes.

## Fase 5 — Idempotencia online
- [x] Exportar `generateIdempotencyKey` para uso general.
- [x] Cobros online (`use-pagos.ts`) generan y envían `idempotencyKey` (backend ya soporta replay idempotente: `pagos.service.ts:282-294` + `ejecutarTxConIdempotencia`).
- [x] Re-encolado con la misma key ante fallo de red (enlazado con 2.6).
- [x] Tests: replay idempotente de cobro online no duplica.
- [x] **FASE 5 COMPLETA**: tsc + jest + lint verdes.

## Fase 6 — Validación final
- [ ] Re-ejecutar QA de certificación (matriz `GUIA_CERTIFICACION_OFFLINE.md` M1–M17 y `GUIA_CERTIFICACION_PERMISOS.md`).
- [x] Backend: tsc 0 + jest verde. Mobile: tsc 0 + jest verde + `expo lint` 0.
- [ ] Resumen final de hallazgos resueltos por fase.
