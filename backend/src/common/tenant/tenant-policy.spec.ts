import { decidirPoliticaTenant, MODELOS_TENANT } from './tenant-policy';

describe('decidirPoliticaTenant (F6)', () => {
  const ctx = { empresaId: 'e1', superAdmin: false };
  const superAdminCtx = { empresaId: null, superAdmin: true };

  it('bypass si no hay contexto (request público/cron)', () => {
    const d = decidirPoliticaTenant({
      modelo: 'Prestamo',
      operacion: 'updateMany',
      where: {},
      contexto: null,
    });
    expect(d.accion).toBe('permitir');
  });

  it('bypass total para SUPERADMIN', () => {
    const d = decidirPoliticaTenant({
      modelo: 'Prestamo',
      operacion: 'updateMany',
      where: {},
      contexto: superAdminCtx,
    });
    expect(d.accion).toBe('permitir');
  });

  it('ignora modelos sin columna empresaId (Cuota, Pago, RutaCliente)', () => {
    for (const modelo of ['Cuota', 'Pago', 'RutaCliente']) {
      const d = decidirPoliticaTenant({
        modelo,
        operacion: 'updateMany',
        where: {},
        contexto: ctx,
      });
      expect(d.accion).toBe('permitir');
    }
  });

  it('bloquea updateMany sin empresaId en un modelo de negocio', () => {
    const d = decidirPoliticaTenant({
      modelo: 'Prestamo',
      operacion: 'updateMany',
      where: { estado: 'ACTIVO' },
      contexto: ctx,
    });
    expect(d.accion).toBe('bloquear');
    if (d.accion === 'bloquear') {
      expect(d.motivo).toContain('Prestamo');
    }
  });

  it('bloquea updateMany sin where (actualización masiva)', () => {
    const d = decidirPoliticaTenant({
      modelo: 'Prestamo',
      operacion: 'updateMany',
      where: undefined,
      contexto: ctx,
    });
    expect(d.accion).toBe('bloquear');
  });

  it('permite updateMany con empresaId en where', () => {
    const d = decidirPoliticaTenant({
      modelo: 'Prestamo',
      operacion: 'updateMany',
      where: { empresaId: 'e1', estado: 'ACTIVO' },
      contexto: ctx,
    });
    expect(d.accion).toBe('permitir');
  });

  it('permite deleteMany con empresaId en where', () => {
    const d = decidirPoliticaTenant({
      modelo: 'Ruta',
      operacion: 'deleteMany',
      where: { empresaId: 'e1' },
      contexto: ctx,
    });
    expect(d.accion).toBe('permitir');
  });

  it('permite updateMany de RutaCliente (sin columna, acotado por ruta)', () => {
    const d = decidirPoliticaTenant({
      modelo: 'RutaCliente',
      operacion: 'updateMany',
      where: { rutaId: 'r1' },
      contexto: ctx,
    });
    expect(d.accion).toBe('permitir');
  });

  it('advierten (no bloquea) lecturas findMany/count sin empresaId', () => {
    const read = decidirPoliticaTenant({
      modelo: 'Cliente',
      operacion: 'findMany',
      where: { activo: true },
      contexto: ctx,
    });
    expect(read.accion).toBe('advertir');

    const count = decidirPoliticaTenant({
      modelo: 'Prestamo',
      operacion: 'count',
      where: undefined,
      contexto: ctx,
    });
    expect(count.accion).toBe('advertir');
  });

  it('no exige empresaId en Usuario (limpieza global de push tokens)', () => {
    const d = decidirPoliticaTenant({
      modelo: 'Usuario',
      operacion: 'updateMany',
      where: { pushToken: 'ExpoToken' },
      contexto: ctx,
    });
    expect(d.accion).toBe('permitir');
  });

  it('el catálogo cubre los modelos de negocio clave', () => {
    for (const modelo of [
      'Cliente',
      'Prestamo',
      'Gasto',
      'CajaSesion',
      'DesembolsoCaja',
      'Ruta',
      'Alerta',
      'Empleado',
      'AsistenciaEmpleado',
      'PagoSalario',
      'DescuentoEmpleado',
      'CapitalEmpresa',
      'InyeccionCapital',
      'RetiroGanancias',
      'MovimientoFinanciero',
      'Usuario',
    ]) {
      expect(MODELOS_TENANT.has(modelo)).toBe(true);
    }
  });
});
