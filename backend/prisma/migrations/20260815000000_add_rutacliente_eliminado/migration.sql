-- C8: soft-delete de RutaCliente. En vez de borrar la fila (los borrados hard
-- no viajan en el delta de sync y dejaban clientes huérfanos en el móvil), se
-- marca `eliminado = true`; el delta la envía con `updatedAt` actualizado y el
-- móvil la filtra al leer.
-- AlterTable
ALTER TABLE "RutaCliente" ADD COLUMN     "eliminado" BOOLEAN NOT NULL DEFAULT false;
