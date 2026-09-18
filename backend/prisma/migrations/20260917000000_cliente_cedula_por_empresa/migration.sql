-- Quitar la unicidad global de cédula. En este historial la restricción se
-- creó como índice único (CREATE UNIQUE INDEX "Cliente_cedula_key"), no como
-- CONSTRAINT; por eso el DROP va por índice. El bloque es defensivo para bases
-- donde exista como constraint.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Cliente_cedula_key'
      AND conrelid = '"Cliente"'::regclass
  ) THEN
    ALTER TABLE "Cliente" DROP CONSTRAINT "Cliente_cedula_key";
  ELSIF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'Cliente_cedula_key'
      AND schemaname = current_schema()
  ) THEN
    DROP INDEX "Cliente_cedula_key";
  END IF;
END $$;

-- Unicidad por empresa (sistema multiempresa)
CREATE UNIQUE INDEX "Cliente_empresaId_cedula_key" ON "Cliente"("empresaId", "cedula");
