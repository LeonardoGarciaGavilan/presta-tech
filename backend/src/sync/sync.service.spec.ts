import { SyncService } from './sync.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('SyncService', () => {
  const permisosCompletos = {
    clientes: true,
    prestamos: true,
    pagos: true,
    rutas: true,
    configuracion: true,
  };

  function buildService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      cliente: { findMany: jest.fn().mockResolvedValue([]) },
      prestamo: { findMany: jest.fn().mockResolvedValue([]) },
      ruta: { findMany: jest.fn().mockResolvedValue([]) },
      rutaCliente: { findMany: jest.fn().mockResolvedValue([]) },
      configuracion: { findUnique: jest.fn().mockResolvedValue(null) },
      ...overrides,
    };
    const service = new SyncService(prisma as unknown as PrismaService);
    return { service, prisma };
  }

  const cuotaPendiente = (
    id: string,
    capital: number,
    interes: number,
    mora: number,
  ) => ({
    id,
    numero: 1,
    monto: capital + interes + mora,
    capital,
    interes,
    mora,
    pagada: false,
    fechaVencimiento: new Date('2026-12-01'),
  });

  const cuotaPagada = (id: string, capital: number, interes: number) => ({
    id,
    numero: 2,
    monto: capital + interes,
    capital,
    interes,
    mora: 0,
    pagada: true,
    fechaVencimiento: new Date('2026-11-01'),
  });

  it('calcula saldoPendiente y moraAcumulada desde las cuotas pendientes', async () => {
    const prestamo = {
      id: 'p1',
      empresaId: 'emp1',
      monto: 10000,
      saldoPendiente: 0, // la columna no es fuente de verdad
      moraAcumulada: 0,
      cuotas: [
        cuotaPagada('c-pagada', 3000, 800),
        cuotaPendiente('c-pendiente', 1000, 500, 50),
      ],
      pagos: [],
      cliente: { id: 'cl1', nombre: 'Ana' },
    };

    const { service } = buildService({
      prestamo: { findMany: jest.fn().mockResolvedValue([prestamo]) },
    });

    const result = await service.cambios('emp1', { isAdmin: true, permisos: permisosCompletos });

    expect(result.prestamos).toHaveLength(1);
    expect(result.prestamos[0].saldoPendiente).toBe(1550);
    expect(result.prestamos[0].moraAcumulada).toBe(50);
    expect(result.serverTime).toBeTruthy();
  });

  it('aplica el filtro updatedAt cuando se pasa un cursor (delta)', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = buildService({ prestamo: { findMany } });

    const desde = new Date('2026-08-01T00:00:00.000Z');
    await service.cambios('emp1', { isAdmin: true, permisos: permisosCompletos }, desde);

    const esperado: { where: { empresaId: string; updatedAt: { gt: Date } } } =
      {
        where: { empresaId: 'emp1', updatedAt: { gt: desde } },
      };
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining(esperado));
  });

  it('devuelve serverTime como cursor válido no anterior al cursor recibido', async () => {
    const { service } = buildService();

    const desde = new Date('2026-08-01T00:00:00.000Z');
    const result = await service.cambios('emp1', { isAdmin: true, permisos: permisosCompletos }, desde);

    expect(result.serverTime).toBeTruthy();
    expect(new Date(result.serverTime).getTime()).toBeGreaterThanOrEqual(
      desde.getTime(),
    );
  });
});
