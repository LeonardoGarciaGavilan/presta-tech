-- CreateTable
CREATE TABLE "DesembolsoCaja" (
    "id" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "concepto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cajaId" TEXT NOT NULL,
    "prestamoId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "DesembolsoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesembolsoCaja_prestamoId_key" ON "DesembolsoCaja"("prestamoId");

-- CreateIndex
CREATE INDEX "DesembolsoCaja_empresaId_createdAt_idx" ON "DesembolsoCaja"("empresaId", "createdAt");

-- CreateIndex
CREATE INDEX "DesembolsoCaja_cajaId_idx" ON "DesembolsoCaja"("cajaId");

-- AddForeignKey
ALTER TABLE "DesembolsoCaja" ADD CONSTRAINT "DesembolsoCaja_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "CajaSesion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesembolsoCaja" ADD CONSTRAINT "DesembolsoCaja_prestamoId_fkey" FOREIGN KEY ("prestamoId") REFERENCES "Prestamo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesembolsoCaja" ADD CONSTRAINT "DesembolsoCaja_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesembolsoCaja" ADD CONSTRAINT "DesembolsoCaja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
