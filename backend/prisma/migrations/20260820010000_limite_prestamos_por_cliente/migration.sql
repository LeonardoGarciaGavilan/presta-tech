-- Límite de préstamos activos (ACTIVO/ATRASADO) por cliente, parametrizable por empresa.
-- 0 = sin límite (comportamiento por defecto, retrocompatible).

-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "maxPrestamosActivosPorCliente" INTEGER NOT NULL DEFAULT 0;
