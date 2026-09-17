-- CreateEnum
CREATE TYPE "TipoUbicacion" AS ENUM ('PROVINCIA', 'MUNICIPIO', 'DISTRITO_MUNICIPAL', 'SECCION', 'BARRIO', 'SUB_BARRIO');

-- CreateTable
CREATE TABLE "Ubicacion" (
    "id" TEXT NOT NULL,
    "codigoOrigen" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoUbicacion" NOT NULL,
    "padreId" TEXT,
    "unidadPadreId" TEXT,
    "provinciaId" TEXT,
    "municipioId" TEXT,
    "municipioNombre" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Ubicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UbicacionVersion" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "version" TEXT NOT NULL,

    CONSTRAINT "UbicacionVersion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN "provinciaId" TEXT,
ADD COLUMN "municipioId" TEXT,
ADD COLUMN "sectorId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Ubicacion_tipo_codigoOrigen_key" ON "Ubicacion"("tipo", "codigoOrigen");
CREATE INDEX "Ubicacion_tipo_provinciaId_idx" ON "Ubicacion"("tipo", "provinciaId");
CREATE INDEX "Ubicacion_tipo_unidadPadreId_idx" ON "Ubicacion"("tipo", "unidadPadreId");
CREATE INDEX "Ubicacion_padreId_idx" ON "Ubicacion"("padreId");
CREATE INDEX "Cliente_provinciaId_idx" ON "Cliente"("provinciaId");
CREATE INDEX "Cliente_municipioId_idx" ON "Cliente"("municipioId");
CREATE INDEX "Cliente_sectorId_idx" ON "Cliente"("sectorId");

-- AddForeignKey
ALTER TABLE "Ubicacion" ADD CONSTRAINT "Ubicacion_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "Ubicacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_provinciaId_fkey" FOREIGN KEY ("provinciaId") REFERENCES "Ubicacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Ubicacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Ubicacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;