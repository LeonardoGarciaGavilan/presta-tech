-- AlterTable: adding per-company loan action toggles to LimiteEmpresa
ALTER TABLE "LimiteEmpresa" ADD COLUMN "accionesPrestamoCancelacion" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "LimiteEmpresa" ADD COLUMN "accionesPrestamoRefinanciamiento" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "LimiteEmpresa" ADD COLUMN "accionesPrestamoRenovacion" BOOLEAN NOT NULL DEFAULT true;
