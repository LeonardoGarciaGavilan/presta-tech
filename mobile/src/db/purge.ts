import { db } from './index';
import { offlineQueue, cajaActiva } from './schema';
import { clearClientes } from '@/db/clientes-db';
import { clearPrestamos } from '@/db/prestamos-db';
import { clearPagos } from '@/db/pagos-db';
import { clearRutas } from '@/db/rutas-db';
import { clearConfiguracion } from '@/db/config-db';
import { clearCachedUser } from '@/db/sync-meta-db';

// C4: al cerrar sesión se purga TODA la data local de la empresa anterior para
// que el siguiente usuario arranque limpio (sin datos, cola offline, caja activa
// ni sync-meta). Cada tabla se borra en su propio try/catch: un fallo aislado no
// debe impedir que el resto del borrado (ni el logout) continúe.
export async function purgeAllTables(): Promise<void> {
  const clears: Array<() => Promise<void> | void> = [
    () => db.delete(offlineQueue).run(),
    () => db.delete(cajaActiva).run(),
    clearClientes,
    clearPrestamos,
    clearPagos,
    clearRutas,
    clearConfiguracion,
    clearCachedUser,
  ];

  for (const clear of clears) {
    try {
      await clear();
    } catch {
      // non-fatal: seguir con el resto de tablas
    }
  }
}
