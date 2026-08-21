-- Reglas parametrizables de refinanciamiento por empresa.
-- 0 = regla desactivada (comportamiento por defecto, retrocompatible).

-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "cuotasRestantesParaRenovar" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxRefinanciamientosPorPrestamo" INTEGER NOT NULL DEFAULT 0;
