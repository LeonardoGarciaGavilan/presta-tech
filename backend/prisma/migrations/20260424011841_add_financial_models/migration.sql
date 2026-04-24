-- CreateEnum
CREATE TYPE "MovimientoFinancieroTipo" AS ENUM ('INYECCION_CAPITAL', 'PAGO_RECIBIDO', 'DESEMBOLSO', 'GASTO', 'RETIRO_GANANCIAS', 'CIERRE_CAJA', 'CORRECCION');

-- CreateEnum
CREATE TYPE "ReferenciaTipo" AS ENUM ('PAGO', 'GASTO', 'DESEMBOLSO', 'INYECCION', 'RETIRO');

-- CreateTable
CREATE TABLE "CapitalEmpresa" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "capitalInicial" DOUBLE PRECISION NOT NULL,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapitalEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InyeccionCapital" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concepto" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InyeccionCapital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetiroGanancias" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concepto" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetiroGanancias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoFinanciero" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" "MovimientoFinancieroTipo" NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "capital" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mora" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion" TEXT,
    "referenciaTipo" "ReferenciaTipo",
    "referenciaId" TEXT,
    "cajaId" TEXT,
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoFinanciero_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CapitalEmpresa_empresaId_key" ON "CapitalEmpresa"("empresaId");

-- CreateIndex
CREATE INDEX "CapitalEmpresa_empresaId_idx" ON "CapitalEmpresa"("empresaId");

-- CreateIndex
CREATE INDEX "InyeccionCapital_empresaId_idx" ON "InyeccionCapital"("empresaId");

-- CreateIndex
CREATE INDEX "InyeccionCapital_empresaId_fecha_idx" ON "InyeccionCapital"("empresaId", "fecha");

-- CreateIndex
CREATE INDEX "InyeccionCapital_usuarioId_idx" ON "InyeccionCapital"("usuarioId");

-- CreateIndex
CREATE INDEX "RetiroGanancias_empresaId_idx" ON "RetiroGanancias"("empresaId");

-- CreateIndex
CREATE INDEX "RetiroGanancias_empresaId_fecha_idx" ON "RetiroGanancias"("empresaId", "fecha");

-- CreateIndex
CREATE INDEX "RetiroGanancias_usuarioId_idx" ON "RetiroGanancias"("usuarioId");

-- CreateIndex
CREATE INDEX "MovimientoFinanciero_empresaId_idx" ON "MovimientoFinanciero"("empresaId");

-- CreateIndex
CREATE INDEX "MovimientoFinanciero_empresaId_tipo_idx" ON "MovimientoFinanciero"("empresaId", "tipo");

-- CreateIndex
CREATE INDEX "MovimientoFinanciero_empresaId_fecha_idx" ON "MovimientoFinanciero"("empresaId", "fecha");

-- CreateIndex
CREATE INDEX "MovimientoFinanciero_cajaId_idx" ON "MovimientoFinanciero"("cajaId");

-- CreateIndex
CREATE INDEX "MovimientoFinanciero_usuarioId_idx" ON "MovimientoFinanciero"("usuarioId");

-- CreateIndex
CREATE INDEX "MovimientoFinanciero_referenciaTipo_referenciaId_idx" ON "MovimientoFinanciero"("referenciaTipo", "referenciaId");

-- AddForeignKey
ALTER TABLE "CapitalEmpresa" ADD CONSTRAINT "CapitalEmpresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InyeccionCapital" ADD CONSTRAINT "InyeccionCapital_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InyeccionCapital" ADD CONSTRAINT "InyeccionCapital_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetiroGanancias" ADD CONSTRAINT "RetiroGanancias_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetiroGanancias" ADD CONSTRAINT "RetiroGanancias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoFinanciero" ADD CONSTRAINT "MovimientoFinanciero_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoFinanciero" ADD CONSTRAINT "MovimientoFinanciero_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
