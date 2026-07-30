-- CreateIndex
CREATE UNIQUE INDEX "Cuota_prestamoId_numero_key" ON "Cuota"("prestamoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_prestamoId_montoTotal_key" ON "Pago"("prestamoId", "montoTotal");
