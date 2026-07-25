import type { Cliente } from '@/types/cliente.types';
import type { Prestamo } from '@/types/prestamo.types';

const clienteNameIndex = new Map<string, Cliente[]>();
const clienteCedulaIndex = new Map<string, Cliente[]>();
const prestamoClienteIndex = new Map<string, Prestamo[]>();

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function addClienteToIndexes(cliente: Cliente) {
  const nombre = normalize(cliente.nombre || '');
  const apellido = normalize(cliente.apellido || '');
  const fullName = `${nombre} ${apellido}`.trim();
  const cedula = normalize(cliente.cedula || '');

  if (fullName) {
    const existing = clienteNameIndex.get(fullName);
    if (existing) {
      existing.push(cliente);
    } else {
      clienteNameIndex.set(fullName, [cliente]);
    }
  }

  if (cedula) {
    const existing = clienteCedulaIndex.get(cedula);
    if (existing) {
      existing.push(cliente);
    } else {
      clienteCedulaIndex.set(cedula, [cliente]);
    }
  }
}

function addPrestamoToIndexes(prestamo: Prestamo) {
  const cliente = (prestamo as any).cliente;
  if (!cliente) return;

  const nombre = normalize(cliente.nombre || '');
  const apellido = normalize(cliente.apellido || '');
  const fullName = `${nombre} ${apellido}`.trim();
  const cedula = normalize(cliente.cedula || '');

  const keys = [fullName, nombre, apellido, cedula].filter(Boolean);
  for (const key of keys) {
    const existing = prestamoClienteIndex.get(key);
    if (existing) {
      existing.push(prestamo);
    } else {
      prestamoClienteIndex.set(key, [prestamo]);
    }
  }
}

export function buildClienteIndex(clientes: Cliente[]) {
  for (const c of clientes) {
    addClienteToIndexes(c);
  }
}

export function buildPrestamoIndex(prestamos: Prestamo[]) {
  for (const p of prestamos) {
    addPrestamoToIndexes(p);
  }
}

export function clearIndexes() {
  clienteNameIndex.clear();
  clienteCedulaIndex.clear();
  prestamoClienteIndex.clear();
}

function searchMap<T>(map: Map<string, T[]>, term: string): T[] {
  const normalized = normalize(term);
  if (!normalized) return [];

  const results: T[] = [];
  const seen = new Set<string>();

  for (const key of map.keys()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      const items = map.get(key)!;
      for (const item of items) {
        const id = (item as any).id;
        if (!seen.has(id)) {
          seen.add(id);
          results.push(item);
        }
      }
    }
  }

  return results;
}

export function searchClientesOffline(term: string, excludeId?: string): Cliente[] {
  let results = searchMap(clienteNameIndex, term);

  const cedulaResults = searchMap(clienteCedulaIndex, term);
  const seen = new Set(results.map((c) => c.id));
  for (const c of cedulaResults) {
    if (!seen.has(c.id)) {
      results.push(c);
      seen.add(c.id);
    }
  }

  if (excludeId) {
    results = results.filter((c) => c.id !== excludeId);
  }

  return results;
}

export function searchPrestamosOffline(term: string): Prestamo[] {
  return searchMap(prestamoClienteIndex, term);
}

export function getAllCachedClientes(): Cliente[] {
  const seen = new Set<string>();
  const results: Cliente[] = [];
  for (const items of clienteNameIndex.values()) {
    for (const c of items) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        results.push(c);
      }
    }
  }
  return results;
}

export function getAllCachedPrestamos(): Prestamo[] {
  const seen = new Set<string>();
  const results: Prestamo[] = [];
  for (const items of prestamoClienteIndex.values()) {
    for (const p of items) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        results.push(p);
      }
    }
  }
  return results;
}
