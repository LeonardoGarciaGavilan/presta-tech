# GUÍA DE CERTIFICACIÓN — MÓDULO OFFLINE (sas-prestamos)

Checklist manual de QA para certificar el módulo offline. Cada caso registra el
resultado esperado de la implementación (Fases 1–5 del plan
`.opencode/plans/certificacion-offline.md`).

## Preparación del entorno de prueba

- App instalada y logueada como **admin** (para probar delta y `rutasAjenas`).
- Activar **modo avión** para simular offline. Para verificar la reconexión,
  desactivarlo y tocar la pantalla / botón de sincronización.
- Cuenta con **datos semilla** (clientes, préstamos con cuotas, caja, rutas).
- Un usuario NO admin con permisos de rutas (para probar C8 `rutasAjenas`).

---

## Matriz de QA manual

| # | Caso | Pasos | Resultado esperado | ✔ |
|---|------|-------|--------------------|---|
| M1 | Cobro offline parcial (C3/C7) | Abrir caja → modo avión → registrar pago parcial de una cuota | Pago se guarda local, saldo/cuota se actualizan, item aparece en cola "pendiente", aparece indicador de sincronización pendiente | |
| M2 | Cobro offline completo (C3/C7) | Offline → pagar monto exacto de una cuota | Cuota marcada pagada, saldo recalculado, item en cola | |
| M3 | Cobro offline con excedente (C7) | Offline → pagar más que la cuota | Excedente cubre **mora → interés → capital** de cuotas futuras (no crea abono suelto perdido) | |
| M4 | Saldo total offline (C7) | Offline → "Saldo total" de un préstamo | Préstamo pasa a PAGADO local, todas las cuotas pagadas, saldo 0 | |
| M5 | Pago offline **sin caja abierta** (C1) | Sin abrir caja → offline → intentar cobrar | Rechazado: "Debes abrir tu caja…" y **no** se encola nada | |
| M6 | Caja abrir/cerrar offline (C2) | Modo avión → abrir caja (y cerrar) | Caja activa se guarda offline y se sincroniza al reconectar | |
| M7 | Arranque en frío offline | Cerrar app con caja abierta y cola pendiente → modo avión → reabrir | App arranca, lee DB local, mantiene caja/cola; cobros offline siguen funcionando | |
| M8 | Kill con item `syncing` (recover + idempotencia) | Pago online a medias (o matar app durante sync) → reabrir | Los items quedan como `pending` de nuevo (`recoverSyncingItems`); el replay no genera doble cobro (idempotencia backend: P2002/BadRequest replay) | |
| M9 | Doble pago / replay (C3/C7) | Encolar pago → reconectar dos veces seguidas | El servidor **no** aplica dos veces el mismo pago | |
| M10 | Pago fallido → limpiar fallidos (C3) | Generar un item fallido (p. ej. caja cerrada en servidor) → limpiarlo | Se elimina el item y se **revierte la mutación local** (rollback del saldo/cuota) | |
| M11 | Cambio de usuario (purga) | Con datos y cola local → cerrar sesión / loguearse con otro usuario | `purgeAllTables` borra todas las tablas locales; sin datos ni cola del usuario anterior | |
| M12 | Reconexión con delta | Varios cobros offline → salir del modo avión → reconectar | La cola se sincroniza en orden, el delta baja los cambios recientes, los `tempId` se reemplazan por ids reales | |
| M13 | "Forzar recarga" | Estando online → botón "Forzar recarga" | Descarga snapshot completo del tenant; sin duplicados (upsert) | |
| M14 | Desactivaciones/borrados (C8) | Admin: quitar cliente de una ruta (soft-delete) → no-admin sincroniza | El móvil recibe `eliminado:true` en el delta, `rutasAjenas` y retira las rutas ajenas del cache/SQLite; al leer, los clientes retirados ya no se muestran | |
| M15 | Historial de pagos offline (C6) | Con pagos offline encolados → abrir historial de pagos del préstamo y "todos los pagos" | Sin conexión se lee el historial local (incluye pagos sintéticos encolados) | |
| M16 | Pagos por transferencia/tarjeta offline | Offline → cobrar con método TRANSFERENCIA / TARJETA | Se encola igual (solo EFECTIVO/OTROS tienen validaciones propias); aparece en historial local | |
| M17 | Estado financiero offline | Offline → abrir sección de finanzas / caja / reportes | Fallback a datos locales sin romper la pantalla | |

---

## Guión extendido recomendado (flujo completo de reconexión)

1. Abrir caja (online).
2. Modo avión.
3. Registrar: pago parcial, pago completo, pago con excedente y un saldo total
   (casos M1–M4).
4. Intentar un cobro con la caja cerrada (M5) → confirmar rechazo.
5. Cerrar la app y reabrirla en modo avión (M7).
6. Salir del modo avión y reconectar (M12): verificar que los 4 cobros se
   aplican **una sola vez** en el servidor (M8/M9) y que saldos/cuotas/pagos
   cuadran con el backend.
7. Desde el panel de admin, quitar un cliente de una ruta; loguear como no-admin
   y sincronizar → el cliente desaparece de la ruta en el móvil (M14).
8. Revisar el historial de pagos offline y de todos los pagos con un pago
   encolado (M15).

## Criterios de cierre

- Todos los casos M1–M17 con ✔ = OK y sin hallazgos bloqueantes.
- Verificación automatizada en verde:
  - Backend: `npx tsc --noEmit` (0) + `npm test` (78 tests / 9 suites).
  - Mobile: `npx tsc --noEmit` (0) + `npm test` (271 tests / 24 suites) +
    `npx expo lint` (0 errores).
