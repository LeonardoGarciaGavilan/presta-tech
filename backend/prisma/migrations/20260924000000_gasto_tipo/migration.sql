-- Persistir el tipo de gasto en la tabla Gasto.
-- Antes el tipo solo vivía en MovimientoFinanciero (GASTO vs GASTO_CAPITAL),
-- por lo que el campo no existía y el dashboard no podía distinguir.

ALTER TABLE "Gasto" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'OPERATIVO';

-- Backfill: derivar el tipo desde el MovimientoFinanciero asociado para no
-- reclasificar gastos CAPITAL existentes como OPERATIVO (evita doble conteo
-- en el dashboard una vez que capitalTotal descuenta GASTO_CAPITAL).
UPDATE "Gasto" g
SET "tipo" = 'CAPITAL'
FROM "MovimientoFinanciero" m
WHERE m."referenciaTipo" = 'GASTO'
  AND m."referenciaId" = g."id"
  AND m."tipo" = 'GASTO_CAPITAL';