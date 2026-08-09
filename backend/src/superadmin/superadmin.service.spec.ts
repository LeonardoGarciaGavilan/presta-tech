import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SuperAdminService } from './superadmin.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { QuotaService } from '../common/quota/quota.service';

jest.mock('../common/utils/auditoria.utils', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue(undefined),
}));

describe('SuperAdminService (límites)', () => {
  function buildService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      empresa: { findUnique: jest.fn() },
      limiteEmpresa: { findUnique: jest.fn(), upsert: jest.fn() },
      usuario: { count: jest.fn().mockResolvedValue(2) },
      cliente: { count: jest.fn().mockResolvedValue(5) },
      prestamo: { count: jest.fn().mockResolvedValue(8) },
      ruta: { count: jest.fn().mockResolvedValue(1) },
      empleado: { count: jest.fn().mockResolvedValue(3) },
      ...overrides,
    };
    const quotaService = {
      contarUso: jest.fn().mockResolvedValue({
        usuarios: 2,
        clientes: 5,
        prestamos: 8,
        prestamosActivos: 8,
        rutas: 1,
        empleados: 3,
      }),
    };
    const service = new SuperAdminService(
      prisma as unknown as PrismaService,
      quotaService as unknown as QuotaService,
    );
    return { service, prisma, quotaService };
  }

  const superadmin = { id: 'sa1', rol: 'SUPERADMIN' };

  it('devuelve defaults y uso en vivo cuando no existe fila de límites', async () => {
    const { service, prisma } = buildService();
    prisma.empresa.findUnique.mockResolvedValue({
      id: 'e1',
      nombre: 'Pruebas',
      activa: true,
      createdAt: new Date('2026-01-01'),
    });
    prisma.limiteEmpresa.findUnique.mockResolvedValue(null);

    const res = await service.obtenerLimites(superadmin, 'e1');

    expect(res.limite).toMatchObject({
      maxUsuarios: null,
      maxMontoPorPrestamo: null,
      modulosDeshabilitados: [],
      activo: true,
    });
    expect(res.uso).toEqual({
      usuarios: 2,
      clientes: 5,
      prestamos: 8,
      prestamosActivos: 8,
      rutas: 1,
      empleados: 3,
    });
    expect(res.modulos).toContain('CLIENTES');
    expect(res.modulos).toContain('PRESTAMOS');
  });

  it('devuelve la fila almacenada cuando existe', async () => {
    const { service, prisma } = buildService();
    prisma.empresa.findUnique.mockResolvedValue({ id: 'e1', nombre: 'X' });
    prisma.limiteEmpresa.findUnique.mockResolvedValue({
      plan: 'Premium',
      maxClientes: 50,
      maxUsuarios: null,
      maxPrestamos: null,
      maxPrestamosActivos: null,
      maxRutas: null,
      maxEmpleados: null,
      maxMontoPorPrestamo: null,
      modulosDeshabilitados: ['SYNC'],
      venceEn: null,
      activo: true,
    });

    const res = await service.obtenerLimites(superadmin, 'e1');

    expect(res.limite).toMatchObject({ plan: 'Premium', maxClientes: 50 });
    expect(res.limite.modulosDeshabilitados).toEqual(['SYNC']);
  });

  it('actualizarLimites hace upsert y filtra módulos inválidos', async () => {
    const { service, prisma } = buildService();
    prisma.empresa.findUnique.mockResolvedValue({ id: 'e1', nombre: 'X' });
    prisma.limiteEmpresa.upsert.mockResolvedValue({});

    await service.actualizarLimites(superadmin, 'e1', {
      plan: 'Premium',
      maxClientes: 100,
      modulosDeshabilitados: ['CLIENTES', 'SYNC'],
    });

    expect(prisma.limiteEmpresa.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          empresaId: 'e1',
          plan: 'Premium',
          maxClientes: 100,
          modulosDeshabilitados: ['CLIENTES', 'SYNC'],
        }),
      }),
    );
  });

  it('rechaza si todos los módulos son desconocidos', async () => {
    const { service, prisma } = buildService();
    prisma.empresa.findUnique.mockResolvedValue({ id: 'e1', nombre: 'X' });

    await expect(
      service.actualizarLimites(superadmin, 'e1', {
        modulosDeshabilitados: ['NO_EXISTE'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lanza NotFound si la empresa no existe', async () => {
    const { service, prisma } = buildService();
    prisma.empresa.findUnique.mockResolvedValue(null);

    await expect(
      service.obtenerLimites(superadmin, 'e1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
