-- AlterTable
ALTER TABLE "RutaCliente" ADD COLUMN     "fechaRuta" TEXT;

-- CreateIndex
CREATE INDEX "RutaCliente_rutaId_fechaRuta_idx" ON "RutaCliente"("rutaId", "fechaRuta");
