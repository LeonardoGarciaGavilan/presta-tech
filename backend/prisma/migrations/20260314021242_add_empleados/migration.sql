-- CreateEnum
CREATE TYPE "FrecuenciaPagoEmpleado" AS ENUM ('SEMANAL', 'QUINCENAL', 'MENSUAL');

-- CreateEnum
CREATE TYPE "EstadoAsistencia" AS ENUM ('PRESENTE', 'AUSENTE', 'TARDANZA', 'MEDIO_DIA', 'FERIADO', 'VACACIONES');

-- CreateEnum
CREATE TYPE "MetodoPagoEmpleado" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE');

-- CreateEnum
CREATE TYPE "TipoDescuento" AS ENUM ('TARDANZA', 'AUSENCIA', 'PRESTAMO', 'OTRO');

-- CreateTable
CREATE TABLE "Empleado" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "telefono" TEXT,
    "celular" TEXT,
    "email" TEXT,
    "cargo" TEXT NOT NULL,
    "departamento" TEXT,
    "salario" DOUBLE PRECISION NOT NULL,
    "frecuenciaPago" "FrecuenciaPagoEmpleado" NOT NULL DEFAULT 'QUINCENAL',
    "fechaIngreso" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsistenciaEmpleado" (
    "id" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "entrada" TEXT,
    "salida" TEXT,
    "horasTrabajadas" DOUBLE PRECISION,
    "estado" "EstadoAsistencia" NOT NULL DEFAULT 'PRESENTE',
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsistenciaEmpleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoSalario" (
    "id" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "descripcion" TEXT,
    "salarioBruto" DOUBLE PRECISION NOT NULL,
    "totalDescuentos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salarioNeto" DOUBLE PRECISION NOT NULL,
    "metodoPago" "MetodoPagoEmpleado" NOT NULL DEFAULT 'EFECTIVO',
    "referencia" TEXT,
    "fechaPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoSalario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DescuentoEmpleado" (
    "id" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" "TipoDescuento" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aplicado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DescuentoEmpleado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Empleado_empresaId_idx" ON "Empleado"("empresaId");

-- CreateIndex
CREATE INDEX "Empleado_empresaId_activo_idx" ON "Empleado"("empresaId", "activo");

-- CreateIndex
CREATE INDEX "AsistenciaEmpleado_empresaId_fecha_idx" ON "AsistenciaEmpleado"("empresaId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "AsistenciaEmpleado_empleadoId_fecha_key" ON "AsistenciaEmpleado"("empleadoId", "fecha");

-- CreateIndex
CREATE INDEX "PagoSalario_empresaId_idx" ON "PagoSalario"("empresaId");

-- CreateIndex
CREATE INDEX "PagoSalario_empleadoId_idx" ON "PagoSalario"("empleadoId");

-- CreateIndex
CREATE INDEX "DescuentoEmpleado_empresaId_idx" ON "DescuentoEmpleado"("empresaId");

-- CreateIndex
CREATE INDEX "DescuentoEmpleado_empleadoId_aplicado_idx" ON "DescuentoEmpleado"("empleadoId", "aplicado");

-- AddForeignKey
ALTER TABLE "AsistenciaEmpleado" ADD CONSTRAINT "AsistenciaEmpleado_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoSalario" ADD CONSTRAINT "PagoSalario_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DescuentoEmpleado" ADD CONSTRAINT "DescuentoEmpleado_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
