jest.mock('../notificaciones/push-notifications.service', () => ({
  PushNotificationsService: class {},
}));

import { PrestamosService } from './prestamos.service';

function buildService(
  overrides: Record<string, unknown> = {},
  quotaOverrides: Record<string, unknown> = {},
) {
  const prisma = {
    prestamo: {
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    },
    cuota: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    usuario: { findUnique: jest.fn().mockResolvedValue({ nombre: 'Sistema' }) },
    alerta: { create: jest.fn().mockResolvedValue({ id: 'alerta-1' }) },
    empresa: { findUnique: jest.fn().mockResolvedValue({ id: 'emp1' }) },
    auditoria: { create: jest.fn().mockResolvedValue({ id: 'aud-1' }) },
    configuracion: { findUnique: jest.fn().mockResolvedValue(null) },
    movimientoFinanciero: { create: jest.fn() },
    pago: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
    ...overrides,
  };
  const quotaService = {
    validar: jest.fn().mockResolvedValue(true),
    ...quotaOverrides,
  };
  const service = new PrestamosService(
    prisma as never,
    quotaService as never,
    undefined,
    undefined,
    undefined,
  );
  return { service, prisma };
}

describe('PrestamosService — saldoPendiente real desde cuotas (1.1)', () => {
  it('refinanciar: historial guarda saldoAntes calculado desde cuotas pendientes (no la columna stale)', async () => {
    const ahora = new Date('2026-08-01T12:00:00.000Z');
    const prestamo = {
      id: 'p1',
      empresaId: 'emp1',
      monto: 400,
      numeroCuotas: 4,
      frecuenciaPago: 'MENSUAL',
      tasaInteres: 5,
      saldoPendiente: 0, // columna stale: nunca se escribe
      estado: 'ACTIVO',
      cuotaMensual: 125,
      fechaVencimiento: ahora,
      moraAcumulada: 0,
      refinanciado: false,
      vecesRefinanciado: 0,
      historialRefinanciamiento: [],
      createdAt: ahora,
      cliente: { nombre: 'Ana', apellido: 'R' },
      cuotas: [
        {
          numero: 1,
          pagada: true,
          monto: 120,
          capital: 100,
          interes: 20,
          mora: 0,
        },
        {
          numero: 2,
          pagada: true,
          monto: 120,
          capital: 100,
          interes: 20,
          mora: 0,
        },
        {
          numero: 3,
          pagada: false,
          monto: 125,
          capital: 100,
          interes: 20,
          mora: 5,
        },
        {
          numero: 4,
          pagada: false,
          monto: 120,
          capital: 100,
          interes: 20,
          mora: 0,
        },
      ],
    };

    let historialGuardado: any[] | null = null;
    const tx = {
      cuota: { deleteMany: jest.fn(), createMany: jest.fn() },
      prestamo: {
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          historialGuardado = data.historialRefinanciamiento;
          return { id: 'p1', estado: 'ACTIVO' };
        }),
      },
    };
    const $transaction = jest
      .fn()
      .mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(prestamo)
      .mockResolvedValue({
        ...prestamo,
        cuotas: [],
        pagos: [],
        garante: null,
        cliente: { ...prestamo.cliente, cedula: '000-1' },
      });

    const { service } = buildService({ prestamo: { findFirst }, $transaction });

    await service.refinanciar(
      'p1',
      { nuevaTasa: 6, nuevasCuotas: 6, motivo: 'Refinanciamiento' },
      'emp1',
      'u1',
    );

    expect(historialGuardado).toHaveLength(1);
    // Cuota 3 (100+20+5) + Cuota 4 (100+20+0) = 245, no la columna (0)
    expect(historialGuardado![0].saldoAntes).toBe(245);
    expect(historialGuardado![0].saldoAntes).not.toBe(0);
    expect(tx.prestamo.update).toHaveBeenCalled();
  });

  it('refinanciar: snapshot guarda detalle completo de las cuotas eliminadas e interesPerdido', async () => {
    const ahora = new Date('2026-08-01T12:00:00.000Z');
    const venc3 = new Date('2026-06-01T12:00:00.000Z');
    const venc4 = new Date('2026-07-01T12:00:00.000Z');
    const prestamo = {
      id: 'p1',
      empresaId: 'emp1',
      monto: 400,
      numeroCuotas: 4,
      frecuenciaPago: 'MENSUAL',
      tasaInteres: 5,
      saldoPendiente: 0,
      estado: 'ACTIVO',
      cuotaMensual: 125,
      fechaVencimiento: ahora,
      moraAcumulada: 0,
      refinanciado: false,
      vecesRefinanciado: 0,
      historialRefinanciamiento: [],
      createdAt: ahora,
      cliente: { nombre: 'Ana', apellido: 'R' },
      cuotas: [
        {
          numero: 1,
          pagada: true,
          monto: 120,
          capital: 100,
          interes: 20,
          mora: 0,
        },
        {
          numero: 2,
          pagada: true,
          monto: 120,
          capital: 100,
          interes: 20,
          mora: 0,
        },
        {
          numero: 3,
          pagada: false,
          monto: 125,
          capital: 100,
          interes: 20,
          mora: 5,
          fechaVencimiento: venc3,
        },
        {
          numero: 4,
          pagada: false,
          monto: 120,
          capital: 100,
          interes: 20,
          mora: 0,
          fechaVencimiento: venc4,
        },
      ],
    };

    let historialGuardado: any[] | null = null;
    const tx = {
      cuota: { deleteMany: jest.fn(), createMany: jest.fn() },
      prestamo: {
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          historialGuardado = data.historialRefinanciamiento;
          return { id: 'p1', estado: 'ACTIVO' };
        }),
      },
    };
    const $transaction = jest
      .fn()
      .mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(prestamo)
      .mockResolvedValue({
        ...prestamo,
        cuotas: [],
        pagos: [],
        garante: null,
        cliente: { ...prestamo.cliente, cedula: '000-1' },
      });

    const { service } = buildService({ prestamo: { findFirst }, $transaction });

    await service.refinanciar(
      'p1',
      { nuevaTasa: 6, nuevasCuotas: 6, motivo: 'Refinanciamiento' },
      'emp1',
      'u1',
    );

    const registro = historialGuardado![0];
    // Solo las 2 cuotas pendientes fueron eliminadas (no las pagadas)
    expect(registro.cuotasEliminadas).toHaveLength(2);
    expect(registro.cuotasEliminadas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          numero: 3,
          monto: 125,
          capital: 100,
          interes: 20,
          mora: 5,
          fechaVencimiento: venc3,
        }),
        expect.objectContaining({
          numero: 4,
          monto: 120,
          capital: 100,
          interes: 20,
          mora: 0,
          fechaVencimiento: venc4,
        }),
      ]),
    );
    // Interés descartado: 20 + 20 = 40 (no se refinancia)
    expect(registro.interesPerdido).toBe(40);
  });
});

describe('PrestamosService — reglas de refinanciamiento parametrizables', () => {
  const ahora = new Date('2026-08-01T12:00:00.000Z');

  function buildPrestamo(cuotasPendientes: number, vecesRefinanciado = 0) {
    const cuotas: any[] = [];
    for (let i = 1; i <= cuotasPendientes; i++) {
      cuotas.push({
        numero: i,
        pagada: false,
        monto: 120,
        capital: 100,
        interes: 20,
        mora: 0,
        fechaVencimiento: ahora,
      });
    }
    return {
      id: 'p1',
      empresaId: 'emp1',
      monto: 400,
      numeroCuotas: cuotasPendientes,
      frecuenciaPago: 'MENSUAL',
      tasaInteres: 5,
      saldoPendiente: 0,
      estado: 'ACTIVO',
      cuotaMensual: 120,
      fechaVencimiento: ahora,
      moraAcumulada: 0,
      refinanciado: false,
      vecesRefinanciado,
      historialRefinanciamiento: [],
      createdAt: ahora,
      cliente: { nombre: 'Ana', apellido: 'R' },
      cuotas,
    };
  }

  function buildRefinanciarMocks() {
    let historialGuardado: any[] | null = null;
    const tx = {
      cuota: { deleteMany: jest.fn(), createMany: jest.fn() },
      prestamo: {
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          historialGuardado = data.historialRefinanciamiento;
          return { id: 'p1', estado: 'ACTIVO' };
        }),
      },
    };
    const $transaction = jest
      .fn()
      .mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));
    return { tx, $transaction, getHistorial: () => historialGuardado };
  }

  function buildServiceConConfig(
    prestamo: ReturnType<typeof buildPrestamo>,
    config: unknown,
  ) {
    const { $transaction, getHistorial } = buildRefinanciarMocks();
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(prestamo)
      .mockResolvedValue({
        ...prestamo,
        cuotas: [],
        pagos: [],
        garante: null,
        cliente: { ...prestamo.cliente, cedula: '000-1' },
      });
    const { service } = buildService({
      prestamo: { findFirst },
      configuracion: { findUnique: jest.fn().mockResolvedValue(config) },
      $transaction,
    });
    return { service, getHistorial };
  }

  it('bloquea cuando cuotasRestantesParaRenovar > cuotas pendientes', async () => {
    const { service } = buildServiceConConfig(buildPrestamo(4), {
      cuotasRestantesParaRenovar: 2,
      maxRefinanciamientosPorPrestamo: 0,
    });

    await expect(
      service.refinanciar(
        'p1',
        { nuevaTasa: 6, nuevasCuotas: 4 },
        'emp1',
        'u1',
      ),
    ).rejects.toThrow(
      'Solo se puede renovar cuando faltan 2 cuota(s) o menos. Este préstamo tiene 4 pendientes.',
    );
  });

  it('permite cuando cuotas pendientes <= cuotasRestantesParaRenovar', async () => {
    const { service, getHistorial } = buildServiceConConfig(buildPrestamo(2), {
      cuotasRestantesParaRenovar: 2,
      maxRefinanciamientosPorPrestamo: 0,
    });

    await service.refinanciar(
      'p1',
      { nuevaTasa: 6, nuevasCuotas: 3 },
      'emp1',
      'u1',
    );
    expect(getHistorial()).toHaveLength(1);
  });

  it('regla desactivada (0/null) no restringe aunque queden muchas cuotas', async () => {
    const { service, getHistorial } = buildServiceConConfig(
      buildPrestamo(10),
      null,
    );

    await service.refinanciar(
      'p1',
      { nuevaTasa: 6, nuevasCuotas: 5 },
      'emp1',
      'u1',
    );
    expect(getHistorial()).toHaveLength(1);
  });

  it('bloquea cuando vecesRefinanciado alcanzó maxRefinanciamientosPorPrestamo', async () => {
    const { service } = buildServiceConConfig(buildPrestamo(2, 2), {
      cuotasRestantesParaRenovar: 0,
      maxRefinanciamientosPorPrestamo: 2,
    });

    await expect(
      service.refinanciar(
        'p1',
        { nuevaTasa: 6, nuevasCuotas: 3 },
        'emp1',
        'u1',
      ),
    ).rejects.toThrow('alcanzó el límite de 2 refinanciamiento(s)');
  });

  it('permite cuando vecesRefinanciado < maxRefinanciamientosPorPrestamo', async () => {
    const { service, getHistorial } = buildServiceConConfig(
      buildPrestamo(2, 1),
      { cuotasRestantesParaRenovar: 0, maxRefinanciamientosPorPrestamo: 2 },
    );

    await service.refinanciar(
      'p1',
      { nuevaTasa: 6, nuevasCuotas: 3 },
      'emp1',
      'u1',
    );
    expect(getHistorial()).toHaveLength(1);
  });
});

describe('PrestamosService — marcarAlertaLeida (2.7)', () => {
  it('incluye empresaId en el where para scoping por tenant', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'alerta-1', leida: true });
    const { service } = buildService({ alerta: { update } });

    await service.marcarAlertaLeida('alerta-1', 'emp_A');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'alerta-1', empresaId: 'emp_A' },
      data: { leida: true },
    });
  });

  it('lanza error si la alerta no pertenece al tenant (P2025)', async () => {
    const PrismaClientKnownRequestError = class extends Error {
      code: string;
      constructor(message: string, code: string) {
        super(message);
        this.code = code;
      }
    };
    const update = jest
      .fn()
      .mockRejectedValue(
        new PrismaClientKnownRequestError('No Alerta found', 'P2025'),
      );
    const { service } = buildService({ alerta: { update } });

    await expect(
      service.marcarAlertaLeida('alerta-otro-tenant', 'emp_A'),
    ).rejects.toThrow();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'alerta-otro-tenant', empresaId: 'emp_A' },
      data: { leida: true },
    });
  });
});

describe('PrestamosService — límite de préstamos activos por cliente', () => {
  const cliente = {
    id: 'c1',
    empresaId: 'emp1',
    activo: true,
    nombre: 'Ana',
    apellido: 'R',
  };

  const dtoBase = {
    clienteId: 'c1',
    monto: 10000,
    tasaInteres: 5,
    numeroCuotas: 6,
    frecuenciaPago: 'MENSUAL' as const,
  };

  function buildCreateService({
    config = null,
    activosCount = 0,
  }: { config?: unknown; activosCount?: number } = {}) {
    const prestamoCreado = {
      id: 'p-new',
      empresaId: 'emp1',
      clienteId: 'c1',
      monto: 10000,
      tasaInteres: 5,
      numeroCuotas: 6,
      frecuenciaPago: 'MENSUAL',
      estado: 'SOLICITADO',
      moraAcumulada: 0,
      cuotas: [],
      pagos: [],
      garante: null,
      cliente: { id: 'c1', nombre: 'Ana', apellido: 'R', cedula: '000-1' },
    };

    // 1ra llamada: cliente en create(); siguientes: findOne al final
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(cliente)
      .mockResolvedValue(prestamoCreado);
    const count = jest.fn().mockResolvedValue(activosCount);

    const { service } = buildService(
      {
        cliente: { findFirst },
        prestamo: {
          findFirst,
          count,
          create: jest.fn().mockResolvedValue(prestamoCreado),
        },
        configuracion: { findUnique: jest.fn().mockResolvedValue(config) },
      },
      // create() usa quotaService.verificar (no validar)
      { verificar: jest.fn().mockResolvedValue({ advertencia: false }) },
    );
    return { service, count };
  }

  it('create: bloquea cuando el cliente alcanzó el límite configurado', async () => {
    const { service } = buildCreateService({
      config: { maxPrestamosActivosPorCliente: 2 },
      activosCount: 2,
    });

    await expect(service.create(dtoBase, 'emp1', 'u1')).rejects.toThrow(
      'alcanzó el límite configurado de 2',
    );
  });

  it('create: permite cuando el cliente está por debajo del límite', async () => {
    const { service } = buildCreateService({
      config: { maxPrestamosActivosPorCliente: 2 },
      activosCount: 1,
    });

    const resultado = await service.create(dtoBase, 'emp1', 'u1');
    expect(resultado).toBeTruthy();
  });

  it('create: el conteo solo incluye ACTIVO y ATRASADO (ni PAGADO/RECHAZADO/CANCELADO ni solicitudes)', async () => {
    const { service, count } = buildCreateService({
      config: { maxPrestamosActivosPorCliente: 2 },
      activosCount: 2,
    });

    await expect(service.create(dtoBase, 'emp1', 'u1')).rejects.toThrow();

    expect(count).toHaveBeenCalledTimes(1);
    const calls = count.mock.calls as Array<
      [{ where: Record<string, unknown> }]
    >;
    expect(calls[0][0].where).toEqual(
      expect.objectContaining({
        clienteId: 'c1',
        empresaId: 'emp1',
        estado: { in: ['ACTIVO', 'ATRASADO'] },
      }),
    );
  });

  it('create: límite 0 (sin límite) permite crear aunque haya muchos activos', async () => {
    const { service } = buildCreateService({
      config: { maxPrestamosActivosPorCliente: 0 },
      activosCount: 99,
    });

    const resultado = await service.create(dtoBase, 'emp1', 'u1');
    expect(resultado).toBeTruthy();
  });

  it('create: sin configuración guardada no restringe (retrocompatible)', async () => {
    const { service } = buildCreateService({ config: null, activosCount: 99 });

    const resultado = await service.create(dtoBase, 'emp1', 'u1');
    expect(resultado).toBeTruthy();
  });

  it('desembolsar: bloquea si el límite se alcanzó después de aprobar la solicitud', async () => {
    const prestamoAprobado = {
      id: 'p1',
      empresaId: 'emp1',
      clienteId: 'c1',
      monto: 5000,
      tasaInteres: 5,
      numeroCuotas: 4,
      frecuenciaPago: 'MENSUAL',
      estado: 'APROBADO',
      modoRapido: false,
      montoTotal: 5500,
      cuotaMensual: 1400,
      fechaInicio: new Date('2026-08-01T12:00:00.000Z'),
      fechaVencimiento: new Date('2026-12-01T12:00:00.000Z'),
      moraAcumulada: 0,
      cliente: { nombre: 'Ana', apellido: 'R' },
      cuotas: [],
    };
    const caja = {
      id: 'caja1',
      estado: 'ABIERTA',
      montoInicial: 100000,
      empresaId: 'emp1',
    };

    // Dentro de la transacción: revalidación de estado + límite
    const tx = {
      cajaSesion: { findUnique: jest.fn().mockResolvedValue(caja) },
      // TenantUtils.findByIdOrThrow accede con el nombre de modelo 'Prestamo'
      Prestamo: {
        findFirst: jest.fn().mockResolvedValue(prestamoAprobado),
      },
      prestamo: {
        findFirst: jest.fn().mockResolvedValue(prestamoAprobado),
        count: jest.fn().mockResolvedValue(2),
      },
      configuracion: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ maxPrestamosActivosPorCliente: 2 }),
      },
    };
    const $transaction = jest
      .fn()
      .mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    const findFirst = jest.fn().mockResolvedValue(prestamoAprobado);
    const { service } = buildService(
      {
        prestamo: { findFirst },
        cajaSesion: { findFirst: jest.fn().mockResolvedValue(caja) },
        $transaction,
      },
      { verificar: jest.fn().mockResolvedValue({ advertencia: false }) },
    );

    await expect(service.desembolsar('p1', 'emp1', 'u1')).rejects.toThrow(
      'alcanzó el límite configurado de 2',
    );

    // La validación se hizo con el conteo transaccional (ACTIVO/ATRASADO)
    expect(tx.prestamo.count).toHaveBeenCalledTimes(1);
    const countCalls = tx.prestamo.count.mock.calls as Array<
      [{ where: Record<string, unknown> }]
    >;
    expect(countCalls[0][0].where.estado).toEqual({
      in: ['ACTIVO', 'ATRASADO'],
    });
  });
});
