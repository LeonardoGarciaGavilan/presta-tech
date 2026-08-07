-- Agrega updatedAt a Prestamo y RutaCliente para la sincronización incremental
-- (GET /sync/cambios). El trigger mantiene updatedAt en cada UPDATE porque el cron
-- de mora usa updateMany (no dispara @updatedAt de Prisma).
-- Cuota y Pago no lo necesitan: las cuotas van anidadas en el préstamo y los pagos
-- son append-only.

-- 1) Prestamo.updatedAt
ALTER TABLE "Prestamo" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
UPDATE "Prestamo" SET "updatedAt" = "createdAt";
CREATE INDEX "Prestamo_empresaId_updatedAt_idx" ON "Prestamo"("empresaId", "updatedAt");

-- 2) RutaCliente.updatedAt
ALTER TABLE "RutaCliente" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
UPDATE "RutaCliente" SET "updatedAt" = "createdAt";
CREATE INDEX "RutaCliente_updatedAt_idx" ON "RutaCliente"("updatedAt");

-- 3) Índices para el delta de Cliente y Ruta
CREATE INDEX "Cliente_empresaId_updatedAt_idx" ON "Cliente"("empresaId", "updatedAt");
CREATE INDEX "Ruta_empresaId_updatedAt_idx" ON "Ruta"("empresaId", "updatedAt");

-- 4) Trigger que mantiene updatedAt = NOW() en cada UPDATE de Prestamo y RutaCliente
CREATE OR REPLACE FUNCTION set_updated_at_timestamp() RETURNS trigger AS $$
BEGIN
  NEW."updatedAt" := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prestamo_updated_at ON "Prestamo";
CREATE TRIGGER trg_prestamo_updated_at
BEFORE UPDATE ON "Prestamo"
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_ruta_cliente_updated_at ON "RutaCliente";
CREATE TRIGGER trg_ruta_cliente_updated_at
BEFORE UPDATE ON "RutaCliente"
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
