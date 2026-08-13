import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UsuarioService } from './usuario.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { QuotaService } from '../common/quota/quota.service';
import type { PermisosService } from '../common/permisos/permisos.service';

jest.mock('../common/utils/auditoria.utils', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue(undefined),
}));

describe('UsuarioService (permisos F3)', () => {
  function buildService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      usuario: {
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      ...overrides,
    };
    const quotaService = {
      verificar: jest
        .fn()
        .mockResolvedValue({ uso: 0, max: null, advertencia: false }),
    };
    const permisosService = {
      invalidarPermisos: jest.fn().mockResolvedValue(undefined),
    };
    const service = new UsuarioService(
      prisma as unknown as PrismaService,
      quotaService as unknown as QuotaService,
      permisosService as unknown as PermisosService,
    );
    return { service, prisma, quotaService, permisosService };
  }

  const admin = { userId: 'admin1', rol: 'ADMIN', empresaId: 'e1' };

  function usuarioTarget(extra: Record<string, unknown> = {}) {
    return {
      id: 'u1',
      nombre: 'Juan',
      email: 'juan@x.com',
      rol: 'EMPLEADO',
      activo: true,
      permisos: [],
      permisosNegados: [],
      authVersion: 0,
      ...extra,
    };
  }

  it('obtenerPermisos devuelve base por rol + matriz + catálogo', async () => {
    const { service, prisma } = buildService();
    prisma.usuario.findFirst.mockResolvedValue(
      usuarioTarget({
        permisos: ['pagos:registrar'],
        permisosNegados: ['clientes:crear'],
      }),
    );

    const res = await service.obtenerPermisos(admin, 'u1');

    expect(res.usuario).toMatchObject({ id: 'u1', rol: 'EMPLEADO' });
    expect(res.base).toEqual(
      expect.arrayContaining(['pagos:ver', 'clientes:ver']),
    );
    expect(res.base).not.toContain('prestamos:aprobar');
    expect(res.permisos).toEqual(['pagos:registrar']);
    expect(res.permisosNegados).toEqual(['clientes:crear']);
    expect(res.catalogo).toContain('prestamos:aprobar');
    expect(res.modulos).toContain('PRESTAMOS');
  });

  it('actualizarPermisos guarda la matriz y hace bump de authVersion', async () => {
    const { service, prisma } = buildService();
    prisma.usuario.findFirst.mockResolvedValue(usuarioTarget());
    prisma.usuario.update.mockResolvedValue({ id: 'u1', authVersion: 1 });

    const res = await service.actualizarPermisos(admin, 'u1', {
      permisos: ['pagos:registrar'],
      permisosNegados: ['clientes:crear'],
    });

    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          permisos: ['pagos:registrar'],
          permisosNegados: ['clientes:crear'],
          authVersion: { increment: 1 },
        }),
      }),
    );
    expect(res.mensaje).toContain('correctamente');
  });

  it('actualizarPermisos invalida la caché de permisos previa', async () => {
    const { service, prisma, permisosService } = buildService();
    prisma.usuario.findFirst.mockResolvedValue(
      usuarioTarget({ authVersion: 3 }),
    );
    prisma.usuario.update.mockResolvedValue({ id: 'u1', authVersion: 4 });

    await service.actualizarPermisos(admin, 'u1', {
      permisos: ['pagos:registrar'],
    });

    expect(permisosService.invalidarPermisos).toHaveBeenCalledWith('u1', 3);
  });

  it('rechaza permisos desconocidos', async () => {
    const { service, prisma } = buildService();
    prisma.usuario.findFirst.mockResolvedValue(usuarioTarget());

    await expect(
      service.actualizarPermisos(admin, 'u1', { permisos: ['NO_EXISTE'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un permiso permitido y denegado a la vez', async () => {
    const { service, prisma } = buildService();
    prisma.usuario.findFirst.mockResolvedValue(usuarioTarget());

    await expect(
      service.actualizarPermisos(admin, 'u1', {
        permisos: ['pagos:registrar'],
        permisosNegados: ['pagos:registrar'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bloquea editar los propios permisos del admin', async () => {
    const { service, prisma } = buildService();
    prisma.usuario.findFirst.mockResolvedValue(usuarioTarget({ id: 'admin1' }));

    await expect(
      service.actualizarPermisos(admin, 'admin1', { permisos: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bloquea editar permisos de un SUPERADMIN', async () => {
    const { service, prisma } = buildService();
    prisma.usuario.findFirst.mockResolvedValue(
      usuarioTarget({ rol: 'SUPERADMIN' }),
    );

    await expect(service.obtenerPermisos(admin, 'u1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lanza NotFound si el usuario no está en la misma empresa', async () => {
    const { service, prisma } = buildService();
    prisma.usuario.findFirst.mockResolvedValue(null);

    await expect(service.obtenerPermisos(admin, 'u999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
