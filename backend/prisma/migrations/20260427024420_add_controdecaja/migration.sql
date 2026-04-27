-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MovimientoFinancieroTipo" ADD VALUE 'GASTO_CAPITAL';
ALTER TYPE "MovimientoFinancieroTipo" ADD VALUE 'AJUSTE_CAJA';

-- AlterTable
ALTER TABLE "CajaSesion" ADD COLUMN     "totalEgresos" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalIngresos" DOUBLE PRECISION NOT NULL DEFAULT 0;
