-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('REFINANCIAMIENTO', 'CAMBIO_FRECUENCIA', 'CAMBIO_TASA', 'CAMBIO_CUOTAS', 'CAMBIO_FECHA_PAGO', 'CANCELACION', 'CAMBIO_ESTADO');

-- CreateTable
CREATE TABLE "Alerta" (
    "id" TEXT NOT NULL,
    "tipo" "TipoAlerta" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "clienteNombre" TEXT NOT NULL,
    "detalle" JSONB NOT NULL DEFAULT '{}',
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empresaId" TEXT NOT NULL,
    "prestamoId" TEXT NOT NULL,

    CONSTRAINT "Alerta_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_prestamoId_fkey" FOREIGN KEY ("prestamoId") REFERENCES "Prestamo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
