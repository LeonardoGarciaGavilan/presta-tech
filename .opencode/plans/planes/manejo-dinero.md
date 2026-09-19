# Plan: Manejo de dinero sin pérdidas por redondeo

Estado global: FASE A COMPLETA · B1 COMPLETA (nueva BD `numeric`) · B2 COMPLETA (mobile céntimos) · QA final pendiente · Última actualización: 2026-09-01

## Diagnóstico (verificado en BD real)

- Backend (PostgreSQL): **todas** las columnas de dinero son `double precision` (Prisma `Float`).
- Mobile (SQLite): `real` en prestamos/cuotas/pagos/config/clientes.
- Bug real de **mora duplicada** tras abono parcial (backend y móvil).
- Paridad offline/online correcta; idempotencia con replay OK.

## Tipos de dato que cambian

| Capa | Actual | Nuevo | Motivo |
|---|---|---|---|
| Backend PG | `Float`/`double precision` | `Decimal`/`numeric(14,2)` | Binario no representa céntimos exactos; decimal sí |
| Mobile SQLite | `real` | `integer` (céntimos enteros) | SQLite no tiene decimal nativo; enteros = exacto |

Tasas/porcentajes (`tasaInteres`, `moraPorcentajeMensual`, etc.), coordenadas y horas **NO cambian** (no son moneda).

### Inventario backend: `Float` → `Decimal @db.Decimal(14,2)`
- [ ] `Prestamo`: monto, montoTotal, saldoPendiente, cuotaMensual, moraAcumulada
- [ ] `Cuota`: monto, capital, interes, mora
- [ ] `Pago`: montoTotal, capital, interes, mora
- [ ] `Configuracion`: tasaInteresBase, moraPorcentajeMensual, montoMinimoPrestamo, montoMaximoPrestamo, montoMaximoPago
- [ ] `CajaSesion`: montoInicial, montoCierre, diferencia, efectivoReal, efectivoSistema, totalEgresos, totalIngresos
- [ ] `DesembolsoCaja`: monto
- [ ] `Gasto`: monto
- [ ] `MovimientoFinanciero`: monto, capital, interes, mora
- [ ] `InyeccionCapital`: monto
- [ ] `RetiroGanancias`: monto
- [ ] `CapitalEmpresa`: capitalInicial
- [ ] `Cliente`: ingresos
- [ ] `Auditoria`: monto
- [ ] `Empleado`: salario
- [ ] `PagoSalario`: salarioBruto, totalDescuentos, salarioNeto
- [ ] `DescuentoEmpleado`: monto
- [ ] `LimiteEmpresa`: maxMontoPorPrestamo

### Inventario mobile: `real` → `integer` (céntimos)
- [ ] `prestamos`: monto, monto_total, saldo_pendiente, cuota_mensual, mora_acumulada
- [ ] `cuotas`: monto, capital, interes, mora
- [ ] `pagos`: monto_total, capital, interes, mora
- [ ] `clientes`: ingresos
- [ ] `configuracion`: monto_minimo_prestamo, monto_maximo_prestamo, monto_maximo_pago

---

## Fase A1 — Corregir el doble conteo de mora
Invariante: `cuota.monto = capital + interes` siempre; la mora vive solo en `cuota.mora`.

- [x] Backend `pagos.service.ts`: pago parcial y excedente → `nuevoMonto = nuevoCapital + nuevoInteres` (sin mora)
- [x] Mobile `prestamos-db.ts`: `aplicarPagoLocal` idem
- [x] Test regresión: cap500/int50/mora25 + abono 10 → debe exigir 565, no 580

## Fase A2 — Helper de dinero + redondeo exhaustivo
- [x] `backend/src/common/utils/money.ts`: `roundMoney` half-away-from-zero + `toCents`/`fromCents`
- [x] `mobile/src/utils/money.ts`: equivalente
- [x] Sustituir `Math.round(x*100)/100` por `roundMoney` en flujos de dinero (prestamos/pagos/caja/reportes/dashboard)
- [x] Redondear `Pago.montoTotal` y `MovimientoFinanciero.monto` al insertar
- [x] Redondear agregados crudos: `reportes.service.ts`, `dashboard.service.ts`
- [x] Tests de límite: 1.005, 2.675, suma N cuotas vs montoTotal

## Fase B1 — Backend: migrar a `numeric(14,2)`
- [x] Cambios en `schema.prisma` (inventario de arriba)
- [x] Migración SQL aplicada (`20260901000000_money_decimal`) — 33 migraciones, DB up to date
- [x] Adaptar Prisma.Decimal en fronteras JSON/API (`m()`, middleware `convertirDecimales`) — tsc 0 errores, suite backend 174/177
- [x] Verificación reconcile en BD: pagos montoTotal=sum(partes) diff 0.00 (143); cuota monto=capital+interes 442/442; mismatches legacy y/n sum(cuotas)=montoTotal (refinanciado/abonos) sin pérdida de redondeo

## Fase B2 — Mobile: dinero en céntimos enteros
- [x] `schema.ts`: `real`→`integer` (solo dinero)
- [x] `migrations.ts`: `SCHEMA_VERSION = 10`, rebuild tolerante v9→v10 (`CAST(ROUND(x*100) AS INTEGER)`)
- [x] Conversión en mappers: `prestamos-db.ts`, `pagos-db.ts`, `clientes-db.ts`, `config-db.ts`
- [x] `offline_queue.data`/`snapshot` permanecen en pesos
- [x] Tests de db: 391/391 (nuevo test v9→v10), lint sin cambios, tsc mobile OK

## QA de cierre
- [ ] Backend: `npm run lint` + `npm test`
- [ ] Mobile: `npm run lint` + `npm test`
- [ ] Script de reconcile sobre la BD
- [ ] Checklist manual: abono parcial con mora, refinanciación, renovación, pago offline+sync, cierre de caja

---

## Orden de despliegue
1. **A1 + A2** (bloquea el bug de mora y afianza el redondeo) → validar y desplegar.
2. **B1 + B2** (migración de tipos) en un build certificado y por separado.