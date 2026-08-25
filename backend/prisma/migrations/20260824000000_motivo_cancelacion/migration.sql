-- Motivo de cancelación de préstamos (auditoría).
-- La cancelación ahora exige motivo y se guarda junto a motivoRechazo
-- para trazabilidad de decisiones sobre préstamos ACTIVO/ATRASADO.

-- AlterTable
ALTER TABLE "Prestamo" ADD COLUMN     "motivoCancelacion" TEXT;
