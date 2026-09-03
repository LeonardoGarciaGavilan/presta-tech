# Plan: Límite de préstamos activos por cliente (parametrizable por empresa)

> Archivo de seguimiento. Marca con `[x]` lo completado.
>
> **Regla de negocio:** cada empresa (admin) puede configurar el máximo de préstamos
> que un cliente puede tener simultáneamente. Solo cuentan los estados `ACTIVO` y
> `ATRASADO`. NO cuentan `SOLICITADO`, `EN_REVISION`, `APROBADO`, `PAGADO`,
> `RECHAZADO` ni `CANCELADO`.
>
> **Decisiones:**
> - Parámetro en `Configuracion.maxPrestamosActivosPorCliente Int @default(0)` — `0 = sin límite`
> - Doble validación backend: al crear la solicitud Y al desembolsar (cierra el hueco
>   de solicitudes aprobadas después de cambiar el límite)
> - Alcance completo: backend + web + móvil
> - El servidor es la fuente de verdad; los avisos en UI son preventivos, no bloqueantes

---

## Parte 1 — Backend

- [x] 1.1 `schema.prisma`: `Configuracion.maxPrestamosActivosPorCliente Int @default(0)`
- [x] 1.2 Migración `limite_prestamos_por_cliente` (aplicada con `prisma migrate deploy`, junto con `reglas_refinanciamiento` pendiente)
- [x] 1.3 DTO `upsert-configuracion.dto.ts`: campo opcional `@IsInt() @Min(0) @Max(100)`
- [x] 1.4 `configuracion.service.ts`: defaults `?? 0` en fallback de `findOne()` (ambas ramas) + en `datosAnteriores`; en `datosNuevos` SIN `?? 0` (patrón anti-reset de UI vieja)
- [x] 1.5 `prestamos.service.ts`: helper privado `validarLimitePrestamosActivos()` (cuenta `ACTIVO`+`ATRASADO` del cliente en su empresa; lanza `BadRequestException` si `count >= max`)
- [x] 1.6 Llamar helper en `create()` (tras validaciones de monto)
- [x] 1.7 Llamar helper en `desembolsar()` dentro de la transacción (tras revalidar estado APROBADO) usando `tx`
- [x] 1.8 ~~Filtro `clienteId`~~ NO necesario: ya existe `GET /prestamos/cliente/:clienteId` (`findByCliente`) que la web puede usar
- [x] 1.9 Tests `prestamos.service.spec.ts`: bloquea al llegar al límite / ATRASADO cuenta / PAGADO-RECHAZADO-CANCELADO-SOLICITADO no cuentan / límite 0 permite / desembolsar bloquea ✅ 16/16 tests del módulo pasan, suite completa 98/98, tsc OK

## Parte 2 — Web (frontend/)

- [x] 2.1 `pages/Configuracion.jsx`: input "Máximo de préstamos activos por cliente" en sección "Límites financieros" (state + carga + payload). Hint: cuenta ACTIVOS y ATRASADOS, vacío/0 = sin límite
- [x] 2.2 `pages/NuevoPrestamo.jsx`: banner ámbar no bloqueante al seleccionar cliente que ya alcanzó el límite (usa `GET /prestamos/cliente/:id` + config ya cargada) ✅ build OK, sin nuevos errores de lint

## Parte 3 — Móvil (mobile/)

- [x] 3.1 `src/api/configuracion.api.ts`: campo en `ConfiguracionResponse` + `UpsertConfiguracionRequest`
- [x] 3.2 `src/schemas/configuracion.schema.ts`: campo zod entero 0–100 nullable/optional
- [x] 3.3 `src/db/schema.ts`: columna `max_prestamos_activos_por_cliente INTEGER DEFAULT 0`
- [x] 3.4 `src/db/migrations.ts`: migración v7 `ALTER TABLE` tolerante a fallos (patrón columna `retryable`) + columna en CREATE TABLE para instalaciones nuevas + `SCHEMA_VERSION = 7`
- [x] 3.5 `src/db/config-db.ts`: mapeo en `rowToConfig` + upsert
- [x] 3.6 `app/.../admin/configuracion.tsx`: input numérico en sección límites + payload
- [x] 3.7 `app/.../prestamos/nuevo.tsx`: aviso best-effort contando ACTIVO/ATRASADO locales (`getPrestamosByClienteId`) vs config cacheada
- [x] 3.8 Extra: `migrations.test.ts` actualizado a v7 (11/11 pasan); fix de `defaultValues` en configuración móvil (campos de refinanciamiento faltaban, error tsc preexistente)

## Verificación final

- [x] Backend: `tsc --noEmit` OK · jest 98/98 · lint sin nuevos errores (baseline ya tenía ~1100 en el proyecto)
- [x] Frontend: `npm run build` OK · lint sin nuevos errores
- [x] Móvil: `tsc --noEmit` OK · jest 316/316 · lint sin nuevos errores (4 warnings preexistentes)

## Notas

- `refinanciar()` no crea préstamos nuevos → no requiere validación
- El préstamo en curso en `desembolsar()` está `APROBADO` → no se cuenta a sí mismo
- Offline móvil: no puede validar reglas del servidor; aviso best-effort con datos locales.
  Si el sync viola la regla, el servidor rechaza y el rollback por snapshot existente revierte
- Fuera de alcance: límites para garantes
