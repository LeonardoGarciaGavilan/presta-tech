-- Eliminar cuotas duplicadas (mismo prestamoId + numero), conservando la más antigua
DELETE FROM "Cuota" WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY "prestamoId", numero ORDER BY "createdAt" ASC
    ) AS rn FROM "Cuota"
  ) t WHERE t.rn > 1
);

-- Eliminar pagos duplicados (mismo prestamoId + montoTotal), conservando el más antiguo
DELETE FROM "Pago" WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY "prestamoId", "montoTotal" ORDER BY "createdAt" ASC
    ) AS rn FROM "Pago"
  ) t WHERE t.rn > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "Cuota_prestamoId_numero_key" ON "Cuota"("prestamoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_prestamoId_montoTotal_key" ON "Pago"("prestamoId", "montoTotal");
