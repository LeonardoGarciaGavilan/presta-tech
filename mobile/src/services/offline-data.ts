import { getAllCachedClientes } from '@/db/clientes-db';
import { getAllCachedPrestamos } from '@/db/prestamos-db';
import type { PaginatedClientesResponse } from '@/types/cliente.types';
import type { EstadoPrestamo, PaginatedPrestamosResponse } from '@/types/prestamo.types';

function normalizar(term?: string): string {
  return (term ?? '').trim().toLowerCase();
}

// Respuestas "una sola página" con totalPaginas: 1. Así `getNextPageParam`
// devuelve undefined y el listado infinito deja de pedir más páginas offline.
function paginadoCompleto<T>(items: T[]): {
  data: T[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
} {
  return {
    data: items,
    total: items.length,
    pagina: 1,
    porPagina: Math.max(items.length, 1),
    totalPaginas: 1,
  };
}

/**
 * Listado offline de clientes desde SQLite. Respeta el filtro de activos y la
 * búsqueda (nombre, apellido, cédula) con la misma semántica de
 * GET /clientes. Ordena por createdAt desc, igual que el servidor.
 */
export function getClientesOffline(
  search?: string,
  verInactivos?: boolean,
): PaginatedClientesResponse {
  const term = normalizar(search);
  const items = getAllCachedClientes()
    .filter((c) => {
      if (!verInactivos && !c.activo) return false;
      if (term) {
        const busqueda = normalizar(`${c.nombre} ${c.apellido ?? ''} ${c.cedula}`);
        if (!busqueda.includes(term)) return false;
      }
      return true;
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return paginadoCompleto(items);
}

/**
 * Listado offline de préstamos desde SQLite. Respeta el filtro de estado y la
 * búsqueda por cliente (nombre, apellido, cédula), igual que GET /prestamos.
 * Ordena por createdAt desc, igual que el servidor.
 */
export function getPrestamosOffline(
  search?: string,
  estado?: EstadoPrestamo | '',
): PaginatedPrestamosResponse {
  const term = normalizar(search);
  const items = getAllCachedPrestamos()
    .filter((p) => {
      if (estado && p.estado !== estado) return false;
      if (term) {
        const busqueda = normalizar(
          `${p.cliente?.nombre ?? ''} ${p.cliente?.apellido ?? ''} ${p.cliente?.cedula ?? ''}`,
        );
        if (!busqueda.includes(term)) return false;
      }
      return true;
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return paginadoCompleto(items);
}
