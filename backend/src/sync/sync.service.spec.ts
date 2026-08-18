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

    const result = await service.cambios('emp1', {
      isAdmin: true,
      permisos: permisosCompletos,
    });

    expect(result.prestamos).toHaveLength(1);
    expect(result.prestamos[0].saldoPendiente).toBe(1550);
    expect(result.prestamos[0].moraAcumulada).toBe(50);
    expect(result.serverTime).toBeTruthy();
  });

  it('aplica el filtro updatedAt cuando se pasa un cursor (delta)', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = buildService({ prestamo: { findMany } });

    const desde = new Date('2026-08-01T00:00:00.000Z');
    await service.cambios(
      'emp1',
      { isAdmin: true, permisos: permisosCompletos },
      desde,
    );

    const esperado: { where: { empresaId: string; updatedAt: { gt: Date } } } =
      {
        where: { empresaId: 'emp1', updatedAt: { gt: desde } },
      };
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining(esperado));
  });

  it('devuelve serverTime como cursor válido no anterior al cursor recibido', async () => {
    const { service } = buildService();

    const desde = new Date('2026-08-01T00:00:00.000Z');
    const result = await service.cambios(
      'emp1',
      { isAdmin: true, permisos: permisosCompletos },
      desde,
    );

    expect(result.serverTime).toBeTruthy();
    expect(new Date(result.serverTime).getTime()).toBeGreaterThanOrEqual(
      desde.getTime(),
    );
  });

  describe('C4-A: las desactivaciones se propagan', () => {
    it('clientes: no filtra activo (un cliente desactivado viaja en el snapshot)', async () => {
      const findMany = jest
        .fn()
        .mockResolvedValue([{ id: 'cl1', nombre: 'Ana', activo: false }]);
      const { service } = buildService({ cliente: { findMany } });

      const result = await service.cambios('emp1', {
        isAdmin: true,
        permisos: permisosCompletos,
      });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ activo: true }),
        }),
      );
      expect(result.clientes[0].activo).toBe(false);
    });

    it('rutas: no filtra activa', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const { service } = buildService({ ruta: { findMany } });

      await service.cambios('emp1', {
        isAdmin: true,
        permisos: permisosCompletos,
      });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ activa: true }),
        }),
      );
    });

    it('rutaClientes: no filtra activa a través de la ruta padre', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const { service } = buildService({ rutaCliente: { findMany } });

      await service.cambios('emp1', {
        isAdmin: true,
        permisos: permisosCompletos,
      });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ruta: expect.not.objectContaining({ activa: true }),
          }),
        }),
      );
    });
  });

  describe('C8: soft-delete de RutaCliente', () => {
    it('rutaClientes: no filtra eliminado (los soft-deleted viajan en el delta)', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const { service } = buildService({ rutaCliente: { findMany } });

      await service.cambios('emp1', {
        isAdmin: true,
        permisos: permisosCompletos,
      });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ eliminado: true }),
        }),
      );
    });

    it('rutaClientes: los registros soft-eliminados llegan con eliminado:true', async () => {
      const eliminado = {
        id: 'rc1',
        rutaId: 'r1',
        clienteId: 'cl1',
        eliminado: true,
      };
      const findMany = jest.fn().mockResolvedValue([eliminado]);
      const { service } = buildService({ rutaCliente: { findMany } });

      const result = await service.cambios('emp1', {
        isAdmin: true,
        permisos: permisosCompletos,
      });

      expect(result.rutaClientes[0].eliminado).toBe(true);
    });

    it('rutas: excluye los rutaClientes eliminados del include anidado', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const { service } = buildService({ ruta: { findMany } });

      await service.cambios('emp1', {
        isAdmin: true,
        permisos: permisosCompletos,
      });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            clientes: expect.objectContaining({
              where: { eliminado: false },
            }),
          }),
        }),
      );
    });
  });

  describe('C8: rutasAjenas para no-admin', () => {
    it('no-admin: incluye ids de rutas ajenas actualizadas desde el cursor', async () => {
      const findMany = jest
        .fn()
        .mockResolvedValue([{ id: 'r-ajena' }, { id: 'r-ajena-2' }]);
      const { service } = buildService({ ruta: { findMany } });

      const desde = new Date('2026-08-01T00:00:00.000Z');
      const result = await service.cambios(
        'emp1',
        {
          isAdmin: false,
          usuarioId: 'u1',
          permisos: permisosCompletos,
        },
        desde,
      );

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            empresaId: 'emp1',
            usuarioId: { not: 'u1' },
            updatedAt: { gt: desde },
          }),
          select: { id: true },
        }),
      );
      expect(result.rutasAjenas).toEqual(['r-ajena', 'r-ajena-2']);
    });

    it('admin: no consulta rutas ajenas y devuelve lista vacía', async () => {
      const findMany = jest.fn();
      const { service } = buildService({ ruta: { findMany } });

      const result = await service.cambios('emp1', {
        isAdmin: true,
        permisos: permisosCompletos,
      });

      expect(result.rutasAjenas).toEqual([]);
    });
  });
});
