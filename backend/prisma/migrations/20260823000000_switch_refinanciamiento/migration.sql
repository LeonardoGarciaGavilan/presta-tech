-- Switch maestro de refinanciamiento de préstamos.
-- Default true: el refinanciamiento ya está activo en producción; el switch
-- solo oculta/bloquea la acción cuando un administrador lo apaga.

-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "permitirRefinanciamiento" BOOLEAN NOT NULL DEFAULT true;
