import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SuperAdminService } from './superadmin.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { QuotaService } from '../common/quota/quota.service';
import type { PermisosService } from '../common/permisos/permisos.service';

jest.mock('../common/utils/auditoria.utils', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue(undefined),
}));

describe('SuperAdminService (límites)', () => {
  function buildService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      empresa: { findUnique: jest.fn() },
      limiteEmpresa: { findUnique: jest.fn(), upsert: jest.fn() },
      usuario: { count: jest.fn().mockResolvedValue(2), updateMany: jest.fn() },
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
    const permisosService = {
      invalidarModulos: jest.fn().mockResolvedValue(undefined),
      invalidarAccionesPrestamo: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SuperAdminService(
      prisma as unknown as PrismaService,
      quotaService as unknown as QuotaService,
      permisosService as unknown as PermisosService,
    );
    return { service, prisma, quotaService, permisosService };
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
    const { service, prisma, permisosService } = buildService();
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

  it('actualizarLimites con módulos hace bump de authVersion e invalida caché', async () => {
    const { service, prisma, permisosService } = buildService();
    prisma.empresa.findUnique.mockResolvedValue({ id: 'e1', nombre: 'X' });
    prisma.limiteEmpresa.upsert.mockResolvedValue({});

    await service.actualizarLimites(superadmin, 'e1', {
      modulosDeshabilitados: ['SYNC'],
    });

    expect(prisma.usuario.updateMany).toHaveBeenCalledWith({
      where: { empresaId: 'e1' },
      data: { authVersion: { increment: 1 } },
    });
    expect(permisosService.invalidarModulos).toHaveBeenCalledWith('e1');
  });

  it('actualizarLimites sin tocar módulos no invalida caché', async () => {
    const { service, prisma, permisosService } = buildService();
    prisma.empresa.findUnique.mockResolvedValue({ id: 'e1', nombre: 'X' });
    prisma.limiteEmpresa.upsert.mockResolvedValue({});

    await service.actualizarLimites(superadmin, 'e1', {
      plan: 'Premium',
      maxClientes: 100,
    });

    expect(prisma.usuario.updateMany).not.toHaveBeenCalled();
    expect(permisosService.invalidarModulos).not.toHaveBeenCalled();
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

  it('obtenerLimites incluye accionesPrestamo en la respuesta', async () => {
    const { service, prisma } = buildService();
    prisma.empresa.findUnique.mockResolvedValue({ id: 'e1', nombre: 'X' });
    prisma.limiteEmpresa.findUnique.mockResolvedValue({
      plan: null,
      maxClientes: null,
      modulosDeshabilitados: [],
      accionesPrestamoCancelacion: false,
      accionesPrestamoRefinanciamiento: true,
      accionesPrestamoRenovacion: false,
      venceEn: null,
      activo: true,
    });

    const res = await service.obtenerLimites(superadmin, 'e1');

    expect(res.limite.accionesPrestamoCancelacion).toBe(false);
    expect(res.limite.accionesPrestamoRefinanciamiento).toBe(true);
    expect(res.limite.accionesPrestamoRenovacion).toBe(false);
  });

  it('obtenerLimites devuelve defaults true cuando no existe fila', async () => {
    const { service, prisma } = buildService();
    prisma.empresa.findUnique.mockResolvedValue({ id: 'e1', nombre: 'X' });
    prisma.limiteEmpresa.findUnique.mockResolvedValue(null);

    const res = await service.obtenerLimites(superadmin, 'e1');

    expect(res.limite.accionesPrestamoCancelacion).toBe(true);
    expect(res.limite.accionesPrestamoRefinanciamiento).toBe(true);
    expect(res.limite.accionesPrestamoRenovacion).toBe(true);
  });

  it('actualizarLimites guarda accionesPrestamo y hace upsert', async () => {
    const { service, prisma } = buildService();
    prisma.empresa.findUnique.mockResolvedValue({ id: 'e1', nombre: 'X' });
    prisma.limiteEmpresa.upsert.mockResolvedValue({});

    await service.actualizarLimites(superadmin, 'e1', {
      accionesPrestamoCancelacion: false,
      accionesPrestamoRefinanciamiento: false,
      accionesPrestamoRenovacion: true,
    });

    expect(prisma.limiteEmpresa.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          empresaId: 'e1',
          accionesPrestamoCancelacion: false,
          accionesPrestamoRefinanciamiento: false,
          accionesPrestamoRenovacion: true,
        }),
      }),
    );
  });

  it('actualizarLimites con cambios en accionesPrestamo hace bump authVersion e invalida caché', async () => {
    const { service, prisma, permisosService } = buildService();
    prisma.empresa.findUnique.mockResolvedValue({ id: 'e1', nombre: 'X' });
    prisma.limiteEmpresa.upsert.mockResolvedValue({});

    await service.actualizarLimites(superadmin, 'e1', {
      accionesPrestamoCancelacion: false,
    });

    expect(prisma.usuario.updateMany).toHaveBeenCalledWith({
      where: { empresaId: 'e1' },
      data: { authVersion: { increment: 1 } },
    });
    expect(permisosService.invalidarAccionesPrestamo).toHaveBeenCalledWith(
      'e1',
    );
  });

  it('actualizarLimites sin cambios en accionesPrestamo ni módulos no invalida nada', async () => {
    const { service, prisma, permisosService } = buildService();
    prisma.empresa.findUnique.mockResolvedValue({ id: 'e1', nombre: 'X' });
    prisma.limiteEmpresa.upsert.mockResolvedValue({});

    await service.actualizarLimites(superadmin, 'e1', {
      plan: 'Premium',
      maxClientes: 100,
    });

    expect(prisma.usuario.updateMany).not.toHaveBeenCalled();
    expect(permisosService.invalidarModulos).not.toHaveBeenCalled();
    expect(permisosService.invalidarAccionesPrestamo).not.toHaveBeenCalled();
  });
});
