-- CreateIndex
CREATE INDEX "Alerta_empresaId_createdAt_idx" ON "Alerta"("empresaId", "createdAt");

-- CreateIndex
CREATE INDEX "Alerta_empresaId_leida_idx" ON "Alerta"("empresaId", "leida");

-- CreateIndex
CREATE INDEX "Alerta_prestamoId_idx" ON "Alerta"("prestamoId");

-- CreateIndex
CREATE INDEX "Auditoria_empresaId_createdAt_idx" ON "Auditoria"("empresaId", "createdAt");

-- CreateIndex
CREATE INDEX "CajaSesion_empresaId_estado_idx" ON "CajaSesion"("empresaId", "estado");

-- CreateIndex
CREATE INDEX "CajaSesion_empresaId_createdAt_idx" ON "CajaSesion"("empresaId", "createdAt");

-- CreateIndex
CREATE INDEX "Cliente_empresaId_idx" ON "Cliente"("empresaId");

-- CreateIndex
CREATE INDEX "Cliente_empresaId_activo_idx" ON "Cliente"("empresaId", "activo");

-- CreateIndex
CREATE INDEX "Cliente_nombre_idx" ON "Cliente"("nombre");

-- CreateIndex
CREATE INDEX "Cuota_prestamoId_idx" ON "Cuota"("prestamoId");

-- CreateIndex
CREATE INDEX "Cuota_pagada_fechaVencimiento_idx" ON "Cuota"("pagada", "fechaVencimiento");

-- CreateIndex
CREATE INDEX "Cuota_prestamoId_pagada_idx" ON "Cuota"("prestamoId", "pagada");

-- CreateIndex
CREATE INDEX "Gasto_empresaId_idx" ON "Gasto"("empresaId");

-- CreateIndex
CREATE INDEX "Gasto_empresaId_fecha_idx" ON "Gasto"("empresaId", "fecha");

-- CreateIndex
CREATE INDEX "Pago_prestamoId_idx" ON "Pago"("prestamoId");

-- CreateIndex
CREATE INDEX "Pago_createdAt_idx" ON "Pago"("createdAt");

-- CreateIndex
CREATE INDEX "Pago_usuarioId_idx" ON "Pago"("usuarioId");

-- CreateIndex
CREATE INDEX "Prestamo_empresaId_idx" ON "Prestamo"("empresaId");

-- CreateIndex
CREATE INDEX "Prestamo_empresaId_estado_idx" ON "Prestamo"("empresaId", "estado");

-- CreateIndex
CREATE INDEX "Prestamo_clienteId_idx" ON "Prestamo"("clienteId");

-- CreateIndex
CREATE INDEX "Prestamo_empresaId_createdAt_idx" ON "Prestamo"("empresaId", "createdAt");

-- CreateIndex
CREATE INDEX "Ruta_empresaId_activa_idx" ON "Ruta"("empresaId", "activa");

-- CreateIndex
CREATE INDEX "Usuario_empresaId_idx" ON "Usuario"("empresaId");
