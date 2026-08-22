-- Renovación de préstamos:
-- - Enum TipoOrigenPrestamo (NORMAL / REFINANCIAMIENTO / RENOVACION)
-- - Estado RENOVADO para préstamos absorbidos por una renovación
-- - Trazabilidad entre préstamos (renovacionDeId + cadena + historial JSON)
-- - Reglas parametrizables por empresa (0 = regla desactivada)

-- CreateEnum
CREATE TYPE "TipoOrigenPrestamo" AS ENUM ('NORMAL', 'REFINANCIAMIENTO', 'RENOVACION');

-- AlterEnum
ALTER TYPE "EstadoPrestamo" ADD VALUE 'RENOVADO';

-- AlterEnum
ALTER TYPE "TipoAlerta" ADD VALUE 'RENOVACION';

-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "permitirRenovacion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxCuotasRestantesParaRenovacion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "incluirInteresEnRenovacion" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "porcentajeMaximoSaldoAplicado" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "maxRenovacionesConsecutivas" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Prestamo" ADD COLUMN     "origen" "TipoOrigenPrestamo" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "renovacionDeId" TEXT,
ADD COLUMN     "cadenaRenovaciones" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "historialRenovacion" JSONB;

-- AddForeignKey
ALTER TABLE "Prestamo" ADD CONSTRAINT "Prestamo_renovacionDeId_fkey" FOREIGN KEY ("renovacionDeId") REFERENCES "Prestamo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Prestamo_empresaId_origen_idx" ON "Prestamo"("empresaId", "origen");

-- CreateIndex
CREATE INDEX "Prestamo_renovacionDeId_idx" ON "Prestamo"("renovacionDeId");
