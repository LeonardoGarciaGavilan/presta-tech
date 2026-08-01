-- Fix: el unique (prestamoId, montoTotal) bloquea pagos legítimos de igual
-- monto en el mismo préstamo (cuotas fijas). Se elimina y se sustituye por
-- dedup duro vía clave de idempotencia.

DROP INDEX IF EXISTS "Pago_prestamoId_montoTotal_key";

ALTER TABLE "Pago" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Pago_idempotencyKey_key" ON "Pago"("idempotencyKey");
