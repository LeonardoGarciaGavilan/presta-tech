import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { JwtService } from '@nestjs/jwt';
import type { PermisosService } from '../common/permisos/permisos.service';
import type { LoginLockoutService } from '../common/lockout/login-lockout.service';

describe('AuthService (accesos en /auth/me — F5)', () => {
  function buildService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      usuario: {
        findUnique: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      ...overrides,
    };
    const jwtService = {
      sign: jest.fn().mockReturnValue('token'),
    };
    const permisosService = {
      permisosEfectivos: jest.fn(),
      modulosDeshabilitados: jest.fn(),
    };
    const loginLockoutService = {
      estaBloqueado: jest.fn().mockResolvedValue({
        bloqueado: false,
        minutosRestantes: null,
      }),
      registrarIntentoFallido: jest.fn(),
      resetear: jest.fn(),
    };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      permisosService as unknown as PermisosService,
      loginLockoutService as unknown as LoginLockoutService,
    );
    return { service, prisma, permisosService, loginLockoutService };
  }

  const EMPLEADO = {
    id: 'u1',
    email: 'emp@x.com',
    nombre: 'Empleado',
    rol: 'EMPLEADO',
    empresaId: 'e1',
    activo: true,
    authVersion: 0,
    password: 'x',
    empresa: { nombre: 'Empresa' },
  };

  const SUPERADMIN = {
    id: 'sa1',
    email: 'sa@x.com',
    nombre: 'Super',
    rol: 'SUPERADMIN',
    empresaId: null,
    activo: true,
    authVersion: 0,
    password: 'x',
    empresa: null,
  };

  it('devuelve permisos efectivos y módulos deshabilitados para EMPLEADO', async () => {
    const { service, prisma, permisosService } = buildService();
    prisma.usuario.findUnique.mockResolvedValue(EMPLEADO);
    permisosService.permisosEfectivos.mockResolvedValue(['clientes:ver']);
    permisosService.modulosDeshabilitados.mockResolvedValue(['SYNC']);

    const res = await service.getCurrentUser('u1');

    expect(res.permisos).toEqual(['clientes:ver']);
    expect(res.modulosDeshabilitados).toEqual(['SYNC']);
    expect(permisosService.modulosDeshabilitados).toHaveBeenCalledWith('e1');
  });

  it('SUPERADMIN hace bypass: permisos *=* y sin módulos deshabilitados', async () => {
    const { service, prisma, permisosService } = buildService();
    prisma.usuario.findUnique.mockResolvedValue(SUPERADMIN);

    const res = await service.getCurrentUser('sa1');

    expect(res.permisos).toEqual(['*']);
    expect(res.modulosDeshabilitados).toEqual([]);
    expect(permisosService.permisosEfectivos).not.toHaveBeenCalled();
  });

  it('lanza Unauthorized si el usuario no existe', async () => {
    const { service, prisma } = buildService();
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(service.getCurrentUser('u1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('AuthService (lockout de login — F6)', () => {
  function buildService() {
    const prisma = {
      usuario: { findUnique: jest.fn() },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      empresa: {
        findUnique: jest.fn().mockResolvedValue({ id: 'e1' }),
      },
      auditoria: { create: jest.fn().mockResolvedValue({}) },
    };
    const jwtService = { sign: jest.fn().mockReturnValue('token') };
    const permisosService = {
      permisosEfectivos: jest.fn().mockResolvedValue([]),
      modulosDeshabilitados: jest.fn().mockResolvedValue([]),
    };
    const loginLockoutService = {
      estaBloqueado: jest.fn().mockResolvedValue({
        bloqueado: false,
        minutosRestantes: null,
      }),
      registrarIntentoFallido: jest.fn(),
      resetear: jest.fn(),
    };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      permisosService as unknown as PermisosService,
      loginLockoutService as unknown as LoginLockoutService,
    );
    return {
      service,
      prisma,
      jwtService,
      permisosService,
      loginLockoutService,
    };
  }

  it('bloquea el login cuando el email+IP está bloqueado', async () => {
    const { service, prisma, loginLockoutService } = buildService();
    loginLockoutService.estaBloqueado.mockResolvedValue({
      bloqueado: true,
      minutosRestantes: 4,
    });

    await expect(
      service.login('a@x.com', 'x', '1.2.3.4', 'ua'),
    ).rejects.toMatchObject({ response: { minutosRestantes: 4 } });
    expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
  });

  it('registra intento fallido cuando las credenciales son inválidas', async () => {
    const { service, prisma, loginLockoutService } = buildService();
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@x.com',
      password: 'hash-distinto',
      activo: true,
    });

    await expect(
      service.login('a@x.com', 'clave-incorrecta', '1.2.3.4', 'ua'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(loginLockoutService.registrarIntentoFallido).toHaveBeenCalledWith(
      'a@x.com',
      '1.2.3.4',
    );
    expect(loginLockoutService.resetear).not.toHaveBeenCalled();
  });

  it('resetea el contador tras un login exitoso', async () => {
    const {
      service,
      prisma,
      jwtService,
      permisosService,
      loginLockoutService,
    } = buildService();
    const bcrypt = require('bcrypt');
    const hash = bcrypt.hashSync('Clave#2024', 10);
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@x.com',
      nombre: 'Ana',
      rol: 'EMPLEADO',
      empresaId: 'e1',
      activo: true,
      debeCambiarPassword: false,
      authVersion: 0,
      password: hash,
      empresa: { nombre: 'Empresa X' },
    });
    permisosService.permisosEfectivos.mockResolvedValue(['clientes:ver']);

    const res = await service.login(
      'a@x.com',
      'Clave#2024',
      '1.2.3.4',
      'ua',
      null,
      'mobile',
    );

    expect(loginLockoutService.resetear).toHaveBeenCalledWith(
      'a@x.com',
      '1.2.3.4',
    );
    expect(res.usuario.email).toBe('a@x.com');
    expect(jwtService.sign).toHaveBeenCalled();
  });
});
