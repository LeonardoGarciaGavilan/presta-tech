import { eq } from 'drizzle-orm';
import { db } from './index';
import { cajaActiva } from './schema';

const CLAVE_ACTIVA = 'activa';

export interface CajaActivaCache {
  id: string;
  estado: string;
  montoInicial: number;
  fecha: string;
  horaApertura: string;
  totalIngresos: number;
  totalEgresos: number;
  cantidadMovimientos: number;
  esOffline?: boolean;
}

// C2: persiste la caja activa (una sola fila) para que el estado sobreviva al
// arranque en frío sin conexión. `null` borra la caja persistida (cierre).
export function saveCajaActiva(caja: CajaActivaCache | null): void {
  if (!caja) {
    db.delete(cajaActiva).run();
    return;
  }
  db.insert(cajaActiva)
    .values({
      id: CLAVE_ACTIVA,
      data: JSON.stringify(caja),
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: cajaActiva.id,
      set: {
        data: JSON.stringify(caja),
        updatedAt: new Date().toISOString(),
      },
    })
    .run();
}

export function getCajaActivaCache(): CajaActivaCache | null {
  const row = db.select().from(cajaActiva).where(eq(cajaActiva.id, CLAVE_ACTIVA)).get();
  if (!row) return null;
  try {
    return JSON.parse(row.data) as CajaActivaCache;
  } catch {
    return null;
  }
}
