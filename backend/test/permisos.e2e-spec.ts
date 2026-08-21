// test/permisos.e2e-spec.ts
// Suite E2E de la barrera de permisos (Fase 6).
//
// Ejecuta contra la MISMA base de datos real (DATABASE_URL del .env).
// Aislamiento: todo el data de la suite usa el prefijo `perm-e2e-<ts>@test.dev`
// (emails) y una empresa `perm-e2e-empresa-<ts>`. afterAll elimina todo lo creado.
//
// Cobertura:
//   - Matriz 200/403 por permiso efectivo (ADMIN, EMPLEADO base, EMPLEADO
//     restringido a solo `clientes:ver`, SUPERADMIN).
//   - Módulo deshabilitado → 403 MODULO_DESACTIVADO (aplica hasta ADMIN).
//   - Propagación de authVersion tras límites de Super Admin y tras cambio de
//     permisos de un usuario.
//   - SUPERADMIN bloqueado en endpoints de negocio (SuperAdminGuard).
jest.mock('expo-server-sdk', () => {
  class Expo {
    static isExpoPushToken = () => false;
    chunkPushNotifications = (messages: any[]) => messages;
    sendPushNotificationsAsync = async () => [];
  }
  return { Expo, ExpoPushMessage: {}, ExpoPushTicket: {} };
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { PERMISOS_EMPLEADO_DEFAULT } from './../src/common/permisos/permisos.constants';

// Base EMPLEADO negando todo menos `clientes:ver` → efectivos = {clientes:ver}
const NEGADOS_SOLO_CLIENTES = PERMISOS_EMPLEADO_DEFAULT.filter(
  (p) => p !== 'clientes:ver',
);
// Base EMPLEADO negando todo menos `clientes:ver` y `pagos:ver`
const NEGADOS_CLIENTES_Y_PAGOS = PERMISOS_EMPLEADO_DEFAULT.filter(
  (p) => p !== 'clientes:ver' && p !== 'pagos:ver',
);

jest.setTimeout(90_000);

const PREFIX = '/api/v1';
const PASSWORD = 'E2ePass!123';

describe('Permisos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const emails = {
    super: `perm-e2e-super-${suffix}@test.dev`,
    admin: `perm-e2e-admin-${suffix}@test.dev`,
    empleado: `perm-e2e-empleado-${suffix}@test.dev`,
    custom: `perm-e2e-custom-${suffix}@test.dev`,
  };

  let empresaId: string;
  let userIds: string[] = [];

  let tokenSuper = '';
  let tokenAdmin = '';
  let tokenEmpleado = '';
  let tokenCustom = '';
  let customUserId = '';

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`${PREFIX}/auth/login`)
      .send({ email, password: PASSWORD })
      .expect(201);
    return res.body.access_token as string;
  }

  function auth(token: string, method: string, url: string) {
    const req = request(app.getHttpServer())[method](url);
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req;
  }

  const get = (t: string, url: string) => auth(t, 'get', url);
  const post = (t: string, url: string, body?: any) =>
    auth(t, 'post', url).send(body ?? {});
  const put = (t: string, url: string, body?: any) =>
    auth(t, 'put', url).send(body ?? {});
  const patch = (t: string, url: string, body?: any) =>
    auth(t, 'patch', url).send(body ?? {});
  const del = (t: string, url: string) => auth(t, 'delete', url);

  const UUID = '00000000-0000-4000-8000-000000000000';

  function expectPermisoDenegado(promise: any) {
    return promise.expect(403).expect((res) => {
      expect(res.body.code).toBe('PERMISO_DENEGADO');
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(PREFIX);
    await app.init();

    prisma = app.get(PrismaService);

    // ── Datos aislados perm-e2e-* ─────────────────────────────────────────
    const empresa = await prisma.empresa.create({
      data: { nombre: `perm-e2e-empresa-${suffix}` },
    });
    empresaId = empresa.id;

    await prisma.configuracion.create({
      data: {
        empresaId,
        tasaInteresBase: 12,
        moraPorcentajeMensual: 5,
        diasGracia: 3,
        permitirAbonoCapital: true,
        montoMinimoPrestamo: 500,
      },
    });

    await prisma.limiteEmpresa.create({
      data: {
        empresaId,
        plan: 'e2e',
        maxUsuarios: 100,
        maxClientes: 100,
        maxPrestamos: 100,
        maxPrestamosActivos: 100,
        maxRutas: 100,
        maxEmpleados: 100,
        maxMontoPorPrestamo: 1_000_000,
        modulosDeshabilitados: [],
        activo: true,
      },
    });

    const hash = await bcrypt.hash(PASSWORD, 10);

    // SUPERADMIN global (empresaId null)
    const superUser = await prisma.usuario.create({
      data: {
        nombre: 'Perm E2E Super',
        email: emails.super,
        password: hash,
        rol: 'SUPERADMIN',
        activo: true,
        debeCambiarPassword: false,
      },
    });

    // ADMIN de la empresa: base = todos los permisos del catálogo
    const admin = await prisma.usuario.create({
      data: {
        nombre: 'Perm E2E Admin',
        email: emails.admin,
        password: hash,
        rol: 'ADMIN',
        activo: true,
        debeCambiarPassword: false,
        empresaId,
      },
    });

    // EMPLEADO: base estándar de EMPLEADO
    const empleado = await prisma.usuario.create({
      data: {
        nombre: 'Perm E2E Empleado',
        email: emails.empleado,
        password: hash,
        rol: 'EMPLEADO',
        activo: true,
        debeCambiarPassword: false,
        empresaId,
      },
    });

    // EMPLEADO restringido: solo clientes:ver (base anulada con negados)
    const custom = await prisma.usuario.create({
      data: {
        nombre: 'Perm E2E Custom',
        email: emails.custom,
        password: hash,
        rol: 'EMPLEADO',
        activo: true,
        debeCambiarPassword: false,
        empresaId,
        permisos: [],
        permisosNegados: NEGADOS_SOLO_CLIENTES,
      },
    });

    userIds = [superUser.id, admin.id, empleado.id, custom.id];
    customUserId = custom.id;

    tokenSuper = await login(emails.super);
    tokenAdmin = await login(emails.admin);
    tokenEmpleado = await login(emails.empleado);
    tokenCustom = await login(emails.custom);
  });

  afterAll(async () => {
    if (!prisma || !empresaId) return;

    // ── Limpieza en orden de dependencias (FK restrict) ───────────────────
    try {
      await prisma.refreshToken.deleteMany({
        where: { usuarioId: { in: userIds } },
      });
      await prisma.auditoria.deleteMany({
        where: { usuarioId: { in: userIds } },
      });
      await prisma.auditoria.deleteMany({ where: { empresaId } });
      await prisma.pago.deleteMany({ where: { prestamo: { empresaId } } });
      await prisma.cuota.deleteMany({ where: { prestamo: { empresaId } } });
      await prisma.rutaCliente.deleteMany({ where: { ruta: { empresaId } } });
      await prisma.movimientoFinanciero.deleteMany({ where: { empresaId } });
      await prisma.desembolsoCaja.deleteMany({ where: { empresaId } });
      await prisma.inyeccionCapital.deleteMany({ where: { empresaId } });
      await prisma.retiroGanancias.deleteMany({ where: { empresaId } });
      await prisma.prestamo.deleteMany({ where: { empresaId } });
      await prisma.ruta.deleteMany({ where: { empresaId } });
      await prisma.alerta.deleteMany({ where: { empresaId } });
      await prisma.gasto.deleteMany({ where: { empresaId } });
      await prisma.cajaSesion.deleteMany({ where: { empresaId } });
      await prisma.capitalEmpresa.deleteMany({ where: { empresaId } });
      await prisma.descuentoEmpleado.deleteMany({
        where: { empleado: { empresaId } },
      });
      await prisma.pagoSalario.deleteMany({ where: { empresaId } });
      await prisma.asistenciaEmpleado.deleteMany({ where: { empresaId } });
      await prisma.empleado.deleteMany({ where: { empresaId } });
      await prisma.cliente.deleteMany({ where: { empresaId } });
      await prisma.configuracion.deleteMany({ where: { empresaId } });
      await prisma.limiteEmpresa.deleteMany({ where: { empresaId } });
      await prisma.usuario.deleteMany({ where: { id: { in: userIds } } });
      await prisma.empresa.deleteMany({ where: { id: empresaId } });
    } catch (err) {
      console.warn('[permisos.e2e] cleanup parcial:', (err as Error).message);
    }

    await app.close();
  });

  describe('Login y datos base', () => {
    it('login devuelve access_token y permisos por rol', async () => {
      const res = await request(app.getHttpServer())
        .post(`${PREFIX}/auth/login`)
        .send({ email: emails.admin, password: PASSWORD })
        .expect(201);
      expect(res.body.access_token).toBeTruthy();
      expect(Array.isArray(res.body.usuario.permisos)).toBe(true);
      expect(res.body.usuario.permisos.length).toBeGreaterThan(0);
    });

    it('usuario restringido solo tiene clientes:ver', async () => {
      const res = await request(app.getHttpServer())
        .post(`${PREFIX}/auth/login`)
        .send({ email: emails.custom, password: PASSWORD })
        .expect(201);
      expect(res.body.usuario.permisos).toEqual(['clientes:ver']);
    });
  });

  describe('ADMIN (base = todos los permisos)', () => {
    it('GET /clientes → 200', () =>
      get(tokenAdmin, `${PREFIX}/clientes`).expect(200));
    it('GET /prestamos → 200', () =>
      get(tokenAdmin, `${PREFIX}/prestamos`).expect(200));
    it('GET /caja → 200', () => get(tokenAdmin, `${PREFIX}/caja`).expect(200));
    it('GET /rutas → 200', () =>
      get(tokenAdmin, `${PREFIX}/rutas`).expect(200));
    it('GET /gastos → 200', () =>
      get(tokenAdmin, `${PREFIX}/gastos`).expect(200));
    it('GET /usuarios → 200', () =>
      get(tokenAdmin, `${PREFIX}/usuarios`).expect(200));
    it('GET /configuracion → 200', () =>
      get(tokenAdmin, `${PREFIX}/configuracion`).expect(200));
    it('GET /dashboard → 200', () =>
      get(tokenAdmin, `${PREFIX}/dashboard`).expect(200));
    it('GET /finanzas/resumen → 200', () =>
      get(tokenAdmin, `${PREFIX}/finanzas/resumen`).expect(200));
    it('GET /empleados → 200', () =>
      get(tokenAdmin, `${PREFIX}/empleados`).expect(200));
    it('GET /auditoria → 200', () =>
      get(tokenAdmin, `${PREFIX}/auditoria`).expect(200));
    it('GET /sync/cambios → 200', () =>
      get(tokenAdmin, `${PREFIX}/sync/cambios`).expect(200));
    it('GET /reportes/estado-general → 200', () =>
      get(tokenAdmin, `${PREFIX}/reportes/estado-general`).expect(200));

    it('POST /clientes → 201 (crea cliente)', async () => {
      const res = await post(tokenAdmin, `${PREFIX}/clientes`, {
        nombre: 'Perm E2E Cliente',
        cedula: `000-0000000-${suffix.slice(-3)}`,
      }).expect(201);
      expect(res.body.id).toBeTruthy();
    });

    it('POST /gastos → 201', async () => {
      const res = await post(tokenAdmin, `${PREFIX}/gastos`, {
        categoria: 'E2E',
        descripcion: 'gasto de prueba',
        monto: 100,
        fecha: new Date().toISOString(),
      }).expect(201);
      expect(res.body.id).toBeTruthy();
    });

    it('PUT /configuracion → 200', async () => {
      const res = await put(tokenAdmin, `${PREFIX}/configuracion`, {
        tasaInteresBase: 13,
        moraPorcentajeMensual: 6,
        diasGracia: 3,
        permitirAbonoCapital: true,
      }).expect(200);
      expect(res.body.tasaInteresBase).toBe(13);
    });

    it('GET /clientes/:uuid → 404 (permiso pasa, registro no existe)', () =>
      get(tokenAdmin, `${PREFIX}/clientes/${UUID}`).expect(404));
  });

  describe('EMPLEADO base', () => {
    it('GET /clientes → 200', () =>
      get(tokenEmpleado, `${PREFIX}/clientes`).expect(200));
    it('GET /prestamos → 200', () =>
      get(tokenEmpleado, `${PREFIX}/prestamos`).expect(200));
    it('GET /caja → 200', () =>
      get(tokenEmpleado, `${PREFIX}/caja`).expect(200));
    it('GET /rutas → 200', () =>
      get(tokenEmpleado, `${PREFIX}/rutas`).expect(200));
    it('GET /configuracion → 200', () =>
      get(tokenEmpleado, `${PREFIX}/configuracion`).expect(200));
    it('GET /dashboard/mobile → 200', () =>
      get(tokenEmpleado, `${PREFIX}/dashboard/mobile`).expect(200));
    it('POST /clientes → 201 (clientes:crear)', async () => {
      const res = await post(tokenEmpleado, `${PREFIX}/clientes`, {
        nombre: 'Perm E2E Cliente Emp',
        cedula: `111-0000000-${suffix.slice(-3)}`,
      }).expect(201);
      expect(res.body.id).toBeTruthy();
    });

    it('GET /gastos → 403 (falta gastos:ver)', () =>
      expectPermisoDenegado(get(tokenEmpleado, `${PREFIX}/gastos`)));
    it('POST /gastos → 403 (falta gastos:crear)', () =>
      expectPermisoDenegado(post(tokenEmpleado, `${PREFIX}/gastos`)));
    it('GET /usuarios → 403 (falta usuarios:ver)', () =>
      expectPermisoDenegado(get(tokenEmpleado, `${PREFIX}/usuarios`)));
    it('GET /finanzas/resumen → 403 (falta finanzas:ver)', () =>
      expectPermisoDenegado(get(tokenEmpleado, `${PREFIX}/finanzas/resumen`)));
    it('GET /empleados → 403 (falta empleados:ver)', () =>
      expectPermisoDenegado(get(tokenEmpleado, `${PREFIX}/empleados`)));
    it('GET /auditoria → 403 (falta auditoria:ver)', () =>
      expectPermisoDenegado(get(tokenEmpleado, `${PREFIX}/auditoria`)));
    it('GET /reportes/cobros → 403 (falta reportes:exportar)', () =>
      expectPermisoDenegado(get(tokenEmpleado, `${PREFIX}/reportes/cobros`)));
    it('PUT /configuracion → 403 (falta configuracion:editar)', () =>
      expectPermisoDenegado(put(tokenEmpleado, `${PREFIX}/configuracion`)));
    it('GET /prestamos/solicitudes → 403 (falta prestamos:revisar)', () =>
      expectPermisoDenegado(
        get(tokenEmpleado, `${PREFIX}/prestamos/solicitudes`),
      ));
    it('PATCH /prestamos/:id/cancelar → 403 (falta prestamos:cancelar)', () =>
      expectPermisoDenegado(
        patch(tokenEmpleado, `${PREFIX}/prestamos/${UUID}/cancelar`),
      ));
    it('DELETE /clientes/:id → 403 (falta clientes:desactivar)', () =>
      expectPermisoDenegado(del(tokenEmpleado, `${PREFIX}/clientes/${UUID}`)));
    it('PATCH /caja/:id/cerrar → 403 (falta caja:ajuste)', () =>
      expectPermisoDenegado(
        patch(tokenEmpleado, `${PREFIX}/caja/${UUID}/cerrar`),
      ));
    it('POST /rutas → 403 (falta rutas:crear)', () =>
      expectPermisoDenegado(post(tokenEmpleado, `${PREFIX}/rutas`)));
    it('POST /empleados → 403 (falta empleados:gestionar)', () =>
      expectPermisoDenegado(post(tokenEmpleado, `${PREFIX}/empleados`)));
    it('POST /usuarios → 403 (falta usuarios:gestionar)', () =>
      expectPermisoDenegado(post(tokenEmpleado, `${PREFIX}/usuarios`)));
  });

  describe('EMPLEADO restringido (solo clientes:ver)', () => {
    it('GET /clientes → 200 (tiene clientes:ver)', () =>
      get(tokenCustom, `${PREFIX}/clientes`).expect(200));
    it('GET /sync/cambios → 200 (solo requiere rol)', () =>
      get(tokenCustom, `${PREFIX}/sync/cambios`).expect(200));

    it('POST /clientes → 403 (falta clientes:crear)', () =>
      expectPermisoDenegado(post(tokenCustom, `${PREFIX}/clientes`)));
    it('PATCH /clientes/:id → 403 (falta clientes:editar)', () =>
      expectPermisoDenegado(patch(tokenCustom, `${PREFIX}/clientes/${UUID}`)));
    it('DELETE /clientes/:id → 403 (falta clientes:desactivar)', () =>
      expectPermisoDenegado(del(tokenCustom, `${PREFIX}/clientes/${UUID}`)));
    it('GET /prestamos → 403 (falta prestamos:ver)', () =>
      expectPermisoDenegado(get(tokenCustom, `${PREFIX}/prestamos`)));
    it('GET /dashboard → 403 (falta dashboard:ver)', () =>
      expectPermisoDenegado(get(tokenCustom, `${PREFIX}/dashboard`)));
    it('GET /configuracion → 403 (falta configuracion:ver)', () =>
      expectPermisoDenegado(get(tokenCustom, `${PREFIX}/configuracion`)));
    it('GET /rutas → 403 (falta rutas:ver)', () =>
      expectPermisoDenegado(get(tokenCustom, `${PREFIX}/rutas`)));
  });

  describe('SUPERADMIN bloqueado en negocio', () => {
    it('GET /superadmin/empresas → 200 (panel funciona)', () =>
      get(tokenSuper, `${PREFIX}/superadmin/empresas`).expect(200));
    it('GET /clientes → 403 (SuperAdminGuard)', () =>
      get(tokenSuper, `${PREFIX}/clientes`).expect(403));
  });

  describe('Propagación authVersion y MODULO_DESACTIVADO', () => {
    let avAdmin: number;

    it('authVersion inicial en login', async () => {
      const res = await request(app.getHttpServer())
        .post(`${PREFIX}/auth/login`)
        .send({ email: emails.admin, password: PASSWORD })
        .expect(201);
      avAdmin = res.body.usuario.authVersion;
      expect(typeof avAdmin).toBe('number');
    });

    it('deshabilitar módulo CLIENTES (Super Admin) → 403 MODULO_DESACTIVADO', async () => {
      await put(
        tokenSuper,
        `${PREFIX}/superadmin/empresas/${empresaId}/limites`,
        {
          modulosDeshabilitados: ['CLIENTES'],
        },
      ).expect(200);

      await get(tokenAdmin, `${PREFIX}/clientes`)
        .expect(403)
        .expect((res) => {
          expect(res.body.code).toBe('MODULO_DESACTIVADO');
        });
      await get(tokenEmpleado, `${PREFIX}/clientes`)
        .expect(403)
        .expect((res) => {
          expect(res.body.code).toBe('MODULO_DESACTIVADO');
        });
    });

    it('authVersion incrementado tras deshabilitar módulo', async () => {
      const res = await get(tokenAdmin, `${PREFIX}/auth/me`).expect(200);
      expect(res.body.authVersion).toBe(avAdmin + 1);
    });

    it('reactivar módulo → 200 de nuevo y authVersion +1 más', async () => {
      await put(
        tokenSuper,
        `${PREFIX}/superadmin/empresas/${empresaId}/limites`,
        {
          modulosDeshabilitados: [],
        },
      ).expect(200);

      await get(tokenAdmin, `${PREFIX}/clientes`).expect(200);
      const res = await get(tokenAdmin, `${PREFIX}/auth/me`).expect(200);
      expect(res.body.authVersion).toBe(avAdmin + 2);
    });

    it('otorgar pagos:ver a usuario restringido → propagación y acceso', async () => {
      await put(tokenAdmin, `${PREFIX}/usuarios/${customUserId}/permisos`, {
        permisos: ['pagos:ver'],
        permisosNegados: NEGADOS_CLIENTES_Y_PAGOS,
      }).expect(200);

      const me = await get(tokenCustom, `${PREFIX}/auth/me`).expect(200);
      expect(me.body.permisos).toContain('pagos:ver');
      expect(me.body.permisos).toContain('clientes:ver');

      await get(tokenCustom, `${PREFIX}/pagos`).expect(200);
    });
  });
});
