/*
  Warnings:

  - Added the required column `tipo` to the `Auditoria` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Auditoria" DROP CONSTRAINT "Auditoria_empresaId_fkey";

-- DropIndex
DROP INDEX "RefreshToken_tokenHash_idx";

-- AlterTable
ALTER TABLE "Auditoria" ADD COLUMN     "datosAnteriores" JSONB,
ADD COLUMN     "datosNuevos" JSONB,
ADD COLUMN     "ip" TEXT,
ADD COLUMN     "monto" DOUBLE PRECISION,
ADD COLUMN     "nivel" TEXT,
ADD COLUMN     "referenciaId" TEXT,
ADD COLUMN     "referenciaTipo" TEXT,
ADD COLUMN     "tipo" TEXT NOT NULL,
ADD COLUMN     "userAgent" TEXT,
ADD COLUMN     "usuarioId" TEXT,
ALTER COLUMN "empresaId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CajaSesion" ADD COLUMN     "efectivoReal" DOUBLE PRECISION,
ADD COLUMN     "efectivoSistema" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "montoMaximoPago" DOUBLE PRECISION,
ADD COLUMN     "montoMaximoPrestamo" DOUBLE PRECISION,
ADD COLUMN     "montoMinimoPrestamo" DOUBLE PRECISION NOT NULL DEFAULT 500;

-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "cajaId" TEXT;

-- AlterTable
ALTER TABLE "Prestamo" ADD COLUMN     "garanteId" TEXT,
ALTER COLUMN "saldoPendiente" SET DEFAULT 0;

-- CreateIndex
CREATE INDEX "Auditoria_empresaId_tipo_idx" ON "Auditoria"("empresaId", "tipo");

-- CreateIndex
CREATE INDEX "Auditoria_empresaId_accion_idx" ON "Auditoria"("empresaId", "accion");

-- CreateIndex
CREATE INDEX "Auditoria_usuarioId_createdAt_idx" ON "Auditoria"("usuarioId", "createdAt");

-- CreateIndex
CREATE INDEX "Cliente_cedula_idx" ON "Cliente"("cedula");

-- CreateIndex
CREATE INDEX "Cliente_telefono_idx" ON "Cliente"("telefono");

-- CreateIndex
CREATE INDEX "Cliente_provincia_municipio_idx" ON "Cliente"("provincia", "municipio");

-- CreateIndex
CREATE INDEX "Cuota_fechaVencimiento_idx" ON "Cuota"("fechaVencimiento");

-- CreateIndex
CREATE INDEX "Pago_cajaId_idx" ON "Pago"("cajaId");

-- CreateIndex
CREATE INDEX "Pago_metodo_idx" ON "Pago"("metodo");

-- CreateIndex
CREATE INDEX "Pago_cajaId_createdAt_idx" ON "Pago"("cajaId", "createdAt");

-- CreateIndex
CREATE INDEX "Prestamo_garanteId_idx" ON "Prestamo"("garanteId");

-- AddForeignKey
ALTER TABLE "Prestamo" ADD CONSTRAINT "Prestamo_garanteId_fkey" FOREIGN KEY ("garanteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "CajaSesion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "RefreshToken_tokenHash_unique" RENAME TO "RefreshToken_tokenHash_key";
