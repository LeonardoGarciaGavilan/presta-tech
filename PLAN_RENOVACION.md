# Plan: Renovación de Préstamos

> Archivo de seguimiento. Marca con `[x]` lo completado.
> La renovación NO toca el refinanciamiento existente — flujo independiente.
>
> **Decisiones confirmadas:**
> - Modelo contable: **doble pata** (Pago liquidación ingreso + Desembolso completo egreso; neto físico = desembolsoNeto)
> - Interés futuro: **cobrar todo por defecto** (`incluirInteresEnRenovacion=true`, parametrizable)
> - Flujo: **atómico instantáneo** (1 transacción, préstamo nuevo nace ACTIVO)
> - Préstamo anterior termina en estado **`RENOVADO`** (nuevo valor del enum)
> - Entrega neta = 0 → **rechazar** (`montoNuevo > saldoAplicado`)
> - Terminología UI: "Saldo anterior aplicado" · "Desembolso neto" · "Aplicación de saldo por renovación"
> - Permiso nuevo `prestamos:renovar` — **solo ADMIN por defecto**
> - Validación de fondos corregida: `efectivoDisponible + saldoAplicado ≥ montoNuevo`
> - Mobile fase 1: **online-only** (mueve caja). Web y offline = follow-up
>
> **Ejemplo de referencia:** préstamo 1000/12 cuotas, quedan 3 (~RD$300) → renueva 1000 → se aplican 300 al saldo anterior → cliente recibe RD$700.

---

## Fase 0 — Schema y migración (backend)

- [x] 0.1 `schema.prisma`: `enum EstadoPrestamo` += `RENOVADO`
- [x] 0.2 `schema.prisma`: nuevo `enum TipoOrigenPrestamo { NORMAL, REFINANCIAMIENTO, RENOVACION }`
- [x] 0.3 `schema.prisma`: `TipoAlerta` += `RENOVACION`
- [x] 0.4 `schema.prisma` Prestamo: `origen TipoOrigenPrestamo @default(NORMAL)` · `renovacionDeId String?` (self-FK + relation) · `cadenaRenovaciones Int @default(0)` · `historialRenovacion Json?` · índice `[empresaId, origen]`
- [x] 0.5 `schema.prisma` Configuracion: `permitirRenovacion Boolean @default(false)` · `maxCuotasRestantesParaRenovacion Int @default(0)` · `incluirInteresEnRenovacion Boolean @default(true)` · `porcentajeMaximoSaldoAplicado Int @default(100)` · `maxRenovacionesConsecutivas Int @default(0)`
- [x] 0.6 Permiso `prestamos:renovar` en `permisos.constants.ts` (lista global + defaults solo ADMIN)
- [x] 0.7 Migración `20260822000000_reglas_renovacion` aplicada con `prisma migrate deploy`
- [x] 0.8 Consumidores enum backend: `TRANSICIONES.RENOVADO: []` (prestamos.service.ts ~491), `reportes.service.ts` (:337 separar renovados), `dashboard.service.ts` (:218 estadoMap + cantidades)
- [x] 0.9 Fallbacks de configuración (`configuracion.service.ts`) con campos nuevos
- [x] 0.10 `tsc --noEmit` backend OK tras cambios

## Fase 1 — Endpoint transaccional `POST /prestamos/:id/renovar`

- [x] 1.1 `dto/renovar-prestamo.dto.ts`: montoNuevo, tasaInteres, numeroCuotas, frecuenciaPago?, fechaInicio?, motivo? (validaciones class-validator espejo refinanciar)
- [x] 1.2 `prestamos.service.ts renovar()`:
  - [x] Lock `SELECT ... FOR UPDATE` del préstamo viejo + validar ACTIVO/ATRASADO + empresa
  - [x] Leer config (patrón cache igual que refinanciar) + reglas: switch, cuotas restantes, cadena, % saldo aplicado
  - [x] Liquidación desglosada: capital siempre · interés si config · mora siempre
  - [x] Validar `montoNuevo > saldoAplicado`, `saldoAplicado ≤ montoNuevo × pct/100`, QuotaService
  - [x] Caja abierta + `efectivoDisponible + saldoAplicado ≥ montoNuevo`
  - [x] Pata ingreso: Pago (desglose, obs. "Aplicación de saldo por renovación", referencia nuevo) + cuotas pagadas + viejo → RENOVADO + MovimientoFinanciero(PAGO_RECIBIDO) + totalIngresos += saldoAplicado
  - [x] Pata egreso: préstamo ACTIVO (origen=RENOVACION, renovacionDeId, cadena+1, snapshot historialRenovacion) + cuotas nuevas + DesembolsoCaja + MovimientoFinanciero(DESEMBOLSO) + totalEgresos += montoNuevo
  - [x] Alerta RENOVACION + auditoría accion RENOVAR (ambos préstamos) + invalidarCache
- [x] 1.3 Controller: ruta con `@RequierePermiso('prestamos:renovar') @Idempotent() @Throttle`
- [x] 1.4 Respuesta: `{ prestamoAnterior, prestamoNuevo, liquidacion: {capital, interes, mora}, desembolsoNeto }`
- [x] 1.5 `tsc --noEmit` OK · lint en baseline exacto (93 mensajes, 0 nuevos)

## Fase 2 — Tests backend

- [x] 2.1 Happy path numérico exacto (1000 → aplica 300 → entrega 700; caja −700 neto)
- [x] 2.2 Validación fondos corregida (caja 800 SÍ permite neto 700; NO permite neto > 800)
- [x] 2.3 Regla switch off → 400 · excede cuotas restantes → 400 · límite consecutivo → 400
- [x] 2.4 `incluirInteresEnRenovacion=false` excluye interés del cálculo
- [x] 2.5 `porcentajeMaximoSaldoAplicado` bloqueante
- [x] 2.6 Entrega cero / montoNuevo ≤ saldoAplicado → 400
- [x] 2.7 Idempotencia doble toque → 1 sola renovación (segundo intento rechazado por estado)
- [x] 2.8 Dashboard/reportes cuentan renovados aparte (implementación en Fase 0 + tests en `reportes.service.spec.ts`)

## Fase 3 — Mobile datos

- [x] 3.1 `types/prestamo.types.ts`: union estado + RenovarPrestamoDto + RespuestaRenovacion + campos Prestamo nuevos
- [x] 3.2 `api/prestamos.api.ts`: `renovar()`
- [x] 3.3 SQLite v8: `db/schema.ts` + `migrations.ts` (ALTER tolerantes: 5 cols configuracion + 4 cols prestamos)
- [x] 3.4 Mapping DB ↔ tipos (serialización/deserialización campos nuevos)
- [x] 3.5 Util `calcularRenovacionLocal()` puro en `utils/amortizacion.ts` + test paridad matemática con backend

## Fase 4 — Mobile UI (online-only)

- [x] 4.1 Hook `useRenovarPrestamo` (patrón useRefinanciar, sin rama offline; mensaje si no hay red)
- [x] 4.2 Componente modal-renovar: contexto → formulario → preview vivo (saldo aplicado / desembolso neto / nueva cuota) → paso confirmación
- [x] 4.3 `[id].tsx`: botón Renovar visible según reglas + badge "Renovado" + sección historial colapsable
- [x] 4.4 `admin/configuracion.tsx`: 5 inputs nuevos con hints ("0 = sin restricción")
- [x] 4.5 Constantes de estado RENOVADO (labels/colores/iconos) + contador estadísticas

## Fase 5 — Verificación

- [x] 5.1 Backend: `npm test` verde · `tsc --noEmit` OK · lint sin errores nuevos
- [x] 5.2 Mobile: `jest` verde · `tsc --noEmit` OK · lint 0 errores
- [ ] 5.3 Smoke manual documentado (arqueo físico cuadra −700, reportes, reglas on/off)

### Guía de smoke manual (pendiente de ejecución)
1. **Setup**: activar `permitirRenovacion` en Configuración → abrir caja con efectivo RD$800.
2. Préstamo de RD$1000/12 cuotas con 9 pagadas y 3 pendientes (~RD$300): pulsar **Renovar** → nuevo monto RD$1000, tasa y cuotas iguales.
3. **Arqueo**: caja debe mostrar ingreso +300 (liquidación) y egreso −1000 (desembolso) → neto físico −700; efectivo final = inicial − 700.
4. Verificar préstamo viejo en estado RENOVADO con badge/historial, y el nuevo ACTIVO con origen "Renovación" y cadena 1.
5. Reportes/dashboard: el viejo cuenta como *renovados* (no pagado ni cancelado); capital no suma a ganancias.
6. Reglas off: desactivar switch → botón oculto en móvil y 400 desde API; probar tope de % saldo y límite consecutivo.
7. Sin conexión: botón Renovar debe mostrar error de conectividad (online-only), sin encolar.

## Follow-ups (fuera de alcance)

Frontend web (`RenovarModal.jsx`) · soporte offline con cola · reporte de cadenas de renovación · flujo solicitud→aprobación en dos fases.

## Post-release fixes (2026-08-22)

- [x] F1. Listados mostraban "Activo" en préstamos renovados: `use-prestamo-estados.ts` (usado por listado y tarjetas) carecía de RENOVADO y su fallback era ACTIVO. Fix: claves `teal`/`tealLight` en theme (light+dark), entrada RENOVADO (icono `refresh-circle`) y chip de filtro "Renovado" en `prestamos/index.tsx`.
- [x] F2. Modal de renovación con `maxHeight: 480` se veía más pequeño que refinanciar → eliminado; ahora crece igual.
- [x] F3. Modo rápido real en renovación (toggle Normal/Rápido, **Rápido por defecto**, sub-modos PAGO/GANANCIA + duración):
  - Backend: `RenovarPrestamoDto` += `modoRapido?` / `montoTotal?` (tasa `@Min(0)` para permitir 0 en rápido); branch en `renovar()` reutiliza `calcularAmortizacionRapida` espejando `create`; el préstamo nuevo guarda `modoRapido: true`. +3 tests (cuotas planas 1200→120×10, falta montoTotal → 400, total ≤ monto → 400).
  - Mobile: payload `{modoRapido, montoTotal, tasaInteres: 0, numeroCuotas: duracion}`; preview vivo con `calcularAmortizacionRapidaLocal` (liquidación reutiliza `calcularRenovacionLocal`, independiente del plan); confirmación muestra "Modo rápido" + Total a cobrar.
  - Liquidación/fondos/caja/reglas sin cambios (no dependen del modo).
- Verificación post-fix: backend tsc OK · **114/114** tests · mobile tsc OK · **324/324** · lint 0 errores.

### Mejoras UX/UI post-release (2026-08-23)

- [x] M1. Pre-validación de fondos: box amarillo con efectivo estimado del cache de caja (`montoInicial+ingresos−egresos`) cuando `efectivo + saldoAplicado < montoNuevo` (misma condición del servidor); advertencia informativa, no bloqueo (cache puede estar obsoleto). Línea "Efectivo estimado en caja" también en confirmación.
- [x] M2. Reset del formulario tras renovación exitosa (estados y modo Rápido por defecto).
- [x] M3. Aviso offline temprano: box si sin conexión + Continuar deshabilitado (guard de mutación como respaldo).
- [x] M4. Botón Renovar oculto cuando switch maestro OFF vía `useConfiguracion()` reactivo (sin config cacheada no se oculta); reglas paramétricas siguen explicándose dentro del modal.
- [x] M5. Teals desde tema (`colors.teal`/`tealLight`) en botón Renovar, badge origen e icono historial.
- [x] M6. Historial distingue modo rápido ("· Modo rápido" + "Total a cobrar") y typo de formato corregido.
- [x] M7. Accesibilidad: `accessibilityRole="button"` + labels en toggles Normal/Rápido y Pago/Ganancia.
- [x] M8. Hint frecuencia traducido ("Actual: mensual").
- [x] M9. "Pago calculado" con redondeo entero igual al backend (`Math.round(total/n)`).
- [x] M10. Tope duración/cuotas 3650: `@Max(3650)` en DTO backend (paridad create) + validación UI ambos modos.
- Verificación: backend tsc OK · **114/114** · mobile tsc OK · **324/324** · lint baselines intactos (service 93, dto 0).

## Orden de ejecución

Fase 0 → 1 → 2 → verificación parcial backend → 3 → 4 → 5
