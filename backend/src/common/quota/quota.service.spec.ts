import { ForbiddenException } from '@nestjs/common';
import { QuotaService } from './quota.service';
import type { PrismaService } from '../../prisma/prisma.service';

describe('QuotaService', () => {
  function buildService(limite: any, counts: Record<string, number> = {}) {
    const prisma = {
      limiteEmpresa: { findUnique: jest.fn().mockResolvedValue(limite) },
      usuario: { count: jest.fn().mockResolvedValue(counts.usuarios ?? 0) },
      cliente: { count: jest.fn().mockResolvedValue(counts.clientes ?? 0) },
      prestamo: {
        count: jest.fn().mockImplementation(
          ({
            where,
          }: {
            where?: { empresaId?: string; estado?: unknown };
          } = {}) =>
            Promise.resolve(
              where?.estado
                ? (counts.prestamosActivos ?? 0)
                : (counts.prestamos ?? 0),
            ),
        ),
      },
      ruta: { count: jest.fn().mockResolvedValue(counts.rutas ?? 0) },
      empleado: { count: jest.fn().mockResolvedValue(counts.empleados ?? 0) },
    };
    const service = new QuotaService(prisma as unknown as PrismaService);
    return { service, prisma };
  }

  const SIN_LIMITE = {
    maxUsuarios: null,
    maxClientes: null,
    maxPrestamos: null,
    maxPrestamosActivos: null,
    maxRutas: null,
    maxEmpleados: null,
    maxMontoPorPrestamo: null,
  };

  const CON_LIMITES = {
    ...SIN_LIMITE,
    maxClientes: 10,
    maxPrestamosActivos: 5,
    maxMontoPorPrestamo: 1000,
  };

  describe('verificar — sin límite configurado', () => {
    it('no bloquea ni avisa cuando max es null', async () => {
      const { service, prisma } = buildService(SIN_LIMITE);
      const res = await service.verificar('e1', 'clientes');
      expect(res).toMatchObject({ uso: 0, max: null, advertencia: false });
      expect(prisma.cliente.count).not.toHaveBeenCalled();
    });

    it('no bloquea el monto por préstamo sin límite', async () => {
      const { service } = buildService(SIN_LIMITE);
      const res = await service.verificar('e1', 'montoPrestamo', {
        monto: 999999,
      });
      expect(res).toMatchObject({ max: null, advertencia: false });
    });
  });

  describe('verificar — bloqueo duro al 100%', () => {
    it('permite por debajo del límite', async () => {
      const { service } = buildService(CON_LIMITES, { clientes: 5 });
      const res = await service.verificar('e1', 'clientes');
      expect(res).toMatchObject({
        uso: 5,
        max: 10,
        porcentaje: 50,
        advertencia: false,
      });
    });

    it('avisa al 90% pero permite', async () => {
      const { service } = buildService(CON_LIMITES, { clientes: 9 });
      const res = await service.verificar('e1', 'clientes');
      expect(res.advertencia).toBe(true);
      expect(res.porcentaje).toBe(90);
      expect(res.mensaje).toContain('90%');
    });

    it('bloquea al llegar al límite exacto', async () => {
      const { service } = buildService(CON_LIMITES, { clientes: 10 });
      await expect(service.verificar('e1', 'clientes')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('bloquea por encima del límite', async () => {
      const { service } = buildService(CON_LIMITES, { clientes: 15 });
      await expect(service.verificar('e1', 'clientes')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('verificar — prestamosActivos', () => {
    it('cuenta solo ACTIVO/ATRASADO', async () => {
      const { service, prisma } = buildService(CON_LIMITES, {
        prestamos: 50,
      });
      prisma.prestamo.count.mockResolvedValueOnce(5);
      await expect(
        service.verificar('e1', 'prestamosActivos'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prisma.prestamo.count).toHaveBeenCalledWith({
        where: {
          empresaId: 'e1',
          estado: { in: ['ACTIVO', 'ATRASADO'] },
        },
      });
    });
    it('permite desembolsar si hay cupo', async () => {
      const { service } = buildService(CON_LIMITES, { prestamos: 0 });
      const res = await service.verificar('e1', 'prestamosActivos');
      expect(res).toMatchObject({ uso: 0, max: 5 });
    });
  });

  describe('verificar — monto por préstamo', () => {
    it('bloquea si el monto supera el máximo del plan', async () => {
      const { service } = buildService(CON_LIMITES);
      await expect(
        service.verificar('e1', 'montoPrestamo', { monto: 1001 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('permite si el monto está dentro del máximo', async () => {
      const { service } = buildService(CON_LIMITES);
      const res = await service.verificar('e1', 'montoPrestamo', {
        monto: 900,
      });
      expect(res).toMatchObject({ uso: 900, max: 1000, porcentaje: 90 });
    });
  });

  describe('contarUso / estadoCuotas', () => {
    it('contarUso devuelve los seis conteos', async () => {
      const { service } = buildService(SIN_LIMITE, {
        usuarios: 2,
        clientes: 5,
        prestamos: 8,
        prestamosActivos: 3,
        rutas: 1,
        empleados: 4,
      });
      const uso = await service.contarUso('e1');
      expect(uso).toEqual({
        usuarios: 2,
        clientes: 5,
        prestamos: 8,
        prestamosActivos: 3,
        rutas: 1,
        empleados: 4,
      });
    });

    it('estadoCuotas expone advertencias >= 90% y montoMax', async () => {
      const { service } = buildService(CON_LIMITES, {
        clientes: 9,
        prestamosActivos: 5,
      });
      const estado = await service.estadoCuotas('e1');

      expect(estado.montoMaxPorPrestamo).toBe(1000);
      const clientes = estado.cuotas.find((c) => c.tipo === 'clientes');
      expect(clientes).toMatchObject({ uso: 9, max: 10, advertencia: true });

      const sinLimite = estado.cuotas.find((c) => c.tipo === 'usuarios');
      expect(sinLimite).toMatchObject({ max: null, advertencia: false });

      expect(estado.advertencias.map((c) => c.tipo)).toEqual(
        expect.arrayContaining(['clientes']),
      );
    });
  });
});
