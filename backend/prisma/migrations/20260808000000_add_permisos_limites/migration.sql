-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "permisos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Usuario" ADD COLUMN     "permisosNegados" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Usuario" ADD COLUMN     "authVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Usuario" ADD COLUMN     "mfaSecret" TEXT;
ALTER TABLE "Usuario" ADD COLUMN     "mfaHabilitado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LimiteEmpresa" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "plan" TEXT,
    "maxUsuarios" INTEGER,
    "maxClientes" INTEGER,
    "maxPrestamos" INTEGER,
    "maxPrestamosActivos" INTEGER,
    "maxRutas" INTEGER,
    "maxEmpleados" INTEGER,
    "maxMontoPorPrestamo" DOUBLE PRECISION,
    "modulosDeshabilitados" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "venceEn" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LimiteEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LimiteEmpresa_empresaId_key" ON "LimiteEmpresa"("empresaId");

-- CreateIndex
CREATE INDEX "LimiteEmpresa_empresaId_idx" ON "LimiteEmpresa"("empresaId");

-- AddForeignKey
ALTER TABLE "LimiteEmpresa" ADD CONSTRAINT "LimiteEmpresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
