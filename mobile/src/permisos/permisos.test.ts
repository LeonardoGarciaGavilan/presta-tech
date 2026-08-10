import { puedeAcceder } from './permisos';

describe('puedeAcceder (F5)', () => {
  const admin = {
    rol: 'ADMIN',
    permisos: ['clientes:ver', 'clientes:crear'],
    modulosDeshabilitados: ['GASTOS'],
  };

  it('sin usuario → sin acceso', () => {
    expect(puedeAcceder({ user: null, permiso: 'clientes:ver' })).toBe(false);
  });

  it('SUPERADMIN hace bypass total', () => {
    expect(
      puedeAcceder({
        user: { rol: 'SUPERADMIN', permisos: [], modulosDeshabilitados: [] },
        permiso: 'prestamos:aprobar',
        modulo: 'GASTOS',
      }),
    ).toBe(true);
  });

  it('permite cuando el permiso está en los efectivos', () => {
    expect(
      puedeAcceder({ user: admin, permiso: 'clientes:crear' }),
    ).toBe(true);
  });

  it('niega cuando el permiso no está', () => {
    expect(
      puedeAcceder({ user: admin, permiso: 'prestamos:aprobar' }),
    ).toBe(false);
  });

  it('admite sin permisos si solo se exige módulo habilitado', () => {
    expect(puedeAcceder({ user: admin, modulo: 'CLIENTES' })).toBe(true);
  });

  it('niega cuando el módulo está deshabilitado', () => {
    expect(puedeAcceder({ user: admin, modulo: 'GASTOS' })).toBe(false);
    expect(
      puedeAcceder({ user: admin, modulo: 'GASTOS', permiso: 'clientes:ver' }),
    ).toBe(false);
  });

  it('permiso "*" (todo) habilita cualquier acción', () => {
    expect(
      puedeAcceder({
        user: { rol: 'ADMIN', permisos: ['*'], modulosDeshabilitados: [] },
        permiso: 'reportes:exportar',
      }),
    ).toBe(true);
  });

  it('tolera usuarios viejos sin permisos ni módulos (default [])', () => {
    const legacy = { rol: 'EMPLEADO' } as any;
    expect(puedeAcceder({ user: legacy, permiso: 'clientes:ver' })).toBe(false);
    expect(puedeAcceder({ user: legacy, modulo: 'SYNC' })).toBe(true);
  });
});
