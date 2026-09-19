# Plan: Mejoras al Refinanciamiento de Préstamos

> Archivo de seguimiento. Marca con `[x]` lo completado.
> Decisiones: snapshot en historial · regla 0=desactivada · indicador solo en detalle · incluir límite de veces.

---

## Parte 1 — Fix update optimista offline (`useRefinanciarPrestamo`)

- [x] 1.1 Extraer `siguienteFecha()` y `calcularAmortizacionLocal()` de `mobile/src/hooks/use-prestamo-preview.ts` a `mobile/src/utils/amortizacion.ts` (hook sigue funcionando importando del util)
- [x] 1.2 Verificar paridad exacta con `calcularAmortizacion()` del backend (`prestamos.service.ts`)
- [x] 1.3 Crear función pura `construirPrestamoRefinanciadoLocal(prestamo, dto, hoy)` en el util (replica backend 1478-1580: saldo = capital+mora sin interés, fechaBase, cuotas nuevas numeradas desde última pagada, campos del préstamo actualizados)
- [x] 1.4 `use-prestamos.ts` branch offline: usar helper, `setQueryData` con objeto completo + `upsertPrestamos` a SQLite + enriquecer `tempDisplay`
- [x] 1.5 Test del helper puro (saldo correcto, numeración, campos actualizados)

## Parte 2 — Modal completo (exponer todo el DTO)

- [x] 2.1 Cambiar prop `prestamoId` → `prestamo: Prestamo` (ajustar `[id].tsx`)
- [x] 2.2 Bloque de contexto: saldo pendiente, cuotas pendientes, tasa y frecuencia actuales
- [x] 2.3 `PickerField` nueva frecuencia (default: actual) + `DatePickerField` nueva fecha próxima cuota (opcional) + `AppInput` motivo
- [x] 2.4 Preview en vivo de la nueva cuota (util local Parte 1)
- [x] 2.5 Validación alineada al backend: tasa 0.1–100, cuotas ≥ 1
- [x] 2.6 Chequeo best-effort de reglas (Parte 5) con configuración cacheada

## Parte 3 — Snapshot de cuotas eliminadas (backend)

- [x] 3.1 `nuevoRegistro` en `refinanciar()`: agregar `cuotasEliminadas[]` ({numero, monto, capital, interes, mora, fechaVencimiento}) antes del deleteMany
- [x] 3.2 Agregar `interesPerdido` al registro
- [x] 3.3 Test backend: snapshot contiene detalle completo de cuotas borradas

## Parte 4 — Visibilidad del refinanciamiento (detalle mobile)

- [x] 4.1 Badge "Refinanciado ×N" junto al estado en `[id].tsx` cuando `refinanciado`
- [x] 4.2 Componente `historial-refinanciamiento.tsx` (sección colapsable con entradas del JSON)
- [x] 4.3 Integrar sección en pantalla de detalle (solo si hay historial)

## Parte 5 — Reglas parametrizables por empresa

### Backend
- [x] 5.1 `schema.prisma`: `Configuracion.cuotasRestantesParaRenovar Int @default(0)` + `maxRefinanciamientosPorPrestamo Int @default(0)`
- [x] 5.2 Migración `reglas_refinanciamiento`
- [x] 5.3 DTO upsert-configuracion: ambos campos `@IsInt() @Min(0)` + máximos
- [x] 5.4 Defaults en fallback de `configuracion.service.ts findOne`
- [x] 5.5 Validaciones en `refinanciar()`: X cuotas restantes + límite de veces (patrón lectura config igual que `actualizarMoras`)
- [x] 5.6 Tests backend: bloquea activa / permite desactivada / límite alcanzado

### Mobile
- [x] 5.7 `src/db/schema.ts` + `migrations.ts`: 2 columnas nuevas en `configuracion`
- [x] 5.8 Mapping DB ↔ tipos (serialización campos nuevos)
- [x] 5.9 `admin/configuracion.tsx`: 2 inputs numéricos con hint "0 = sin restricción"

---

## Orden de ejecución

1. Parte 3 → 2. Parte 5 backend → 3. Parte 1 → 4. Parte 2 → 5. Parte 4 → 6. Parte 5 mobile

## Verificación final

- [x] Backend: `npm test` → 92/92 pasando · `tsc --noEmit` OK · lint en baseline (0 errores nuevos)
- [x] Mobile: `jest` → 315/315 pasando · `tsc --noEmit` OK · lint 0 errores
- [ ] Smoke manual documentado (online / offline / sync / reglas) — pendiente en dispositivo/emulador

## Notas

- Fuera de alcance: frontend web (página configuración web) — follow-up
- Offline no puede validar reglas del servidor: chequeo best-effort con config cacheada; el servidor es la fuente de verdad (item fallará en sync si viola regla, con rollback por snapshot existente)
