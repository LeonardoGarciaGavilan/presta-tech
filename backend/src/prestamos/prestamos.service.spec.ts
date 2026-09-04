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
      .mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

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
      .mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

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
      .mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));
    return { tx, $transaction, getHistorial: () => historialGuardado };
  }

  function buildServiceConConfig(
    prestamo: ReturnType<typeof buildPrestamo>,
    config: unknown,
  ) {
    const { tx, $transaction, getHistorial } = buildRefinanciarMocks();
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
    return { service, getHistorial, tx };
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

  it('switch maestro apagado → rechaza', async () => {
    const { service } = buildServiceConConfig(buildPrestamo(4), {
      permitirRefinanciamiento: false,
      cuotasRestantesParaRenovar: 0,
      maxRefinanciamientosPorPrestamo: 0,
    });

    await expect(
      service.refinanciar(
        'p1',
        { nuevaTasa: 6, nuevasCuotas: 3 },
        'emp1',
        'u1',
      ),
    ).rejects.toThrow(/no está habilitado/);
  });

  it('sin el campo permitirRefinanciamiento en config (cliente/cache antiguo) → permite', async () => {
    const { service, getHistorial } = buildServiceConConfig(buildPrestamo(2), {
      cuotasRestantesParaRenovar: 0,
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

  it('modo rápido: genera cuotas planas idénticas a crear rápido y guarda modoRapido/montoTotal (tasa 0 permitida)', async () => {
    // buildPrestamo(4): 4 cuotas pendientes × capital 100 → saldo refinanciado 400
    const { service, getHistorial, tx } = buildServiceConConfig(
      buildPrestamo(4),
      null,
    );

    await service.refinanciar(
      'p1',
      { nuevasCuotas: 10, modoRapido: true, montoTotal: 1200 },
      'emp1',
      'u1',
    );

    const updateData = tx.prestamo.update.mock.calls[0][0].data;
    expect(updateData.modoRapido).toBe(true);
    expect(updateData.tasaInteres).toBe(0);
    expect(updateData.montoTotal).toBe(1200);

    // Cuotas planas de RD$120 (1200/10), última ajustada
    const cuotas = tx.cuota.createMany.mock.calls[0][0].data;
    expect(cuotas).toHaveLength(10);
    for (const c of cuotas) {
      expect(c.monto).toBe(120);
    }

    const historial = getHistorial() as any[];
    expect(historial).toHaveLength(1);
    expect(historial[0].modoRapido).toBe(true);
    expect(historial[0].nuevaTasa).toBe(0);
    expect(historial[0].nuevoMontoTotal).toBe(1200);
  });

  it('modo rápido sin montoTotal → rechaza con BadRequest', async () => {
    const { service } = buildServiceConConfig(buildPrestamo(4), null);

    await expect(
      service.refinanciar(
        'p1',
        { nuevasCuotas: 10, modoRapido: true },
        'emp1',
        'u1',
      ),
    ).rejects.toThrow('montoTotal inválido o ausente para modo rápido.');
  });

  it('modo rápido con montoTotal <= saldo refinanciado → rechaza', async () => {
    const { service } = buildServiceConConfig(buildPrestamo(4), null);

    await expect(
      service.refinanciar(
        'p1',
        { nuevasCuotas: 10, modoRapido: true, montoTotal: 400 },
        'emp1',
        'u1',
      ),
    ).rejects.toThrow(
      'El total a cobrar debe ser mayor al saldo refinanciado.',
    );
  });

  it('modo rápido con nuevaTasa > 0 → rechaza (la tasa no aplica en modo rápido)', async () => {
    const { service } = buildServiceConConfig(buildPrestamo(4), null);

    await expect(
      service.refinanciar(
        'p1',
        { nuevaTasa: 5, nuevasCuotas: 10, modoRapido: true, montoTotal: 1200 },
        'emp1',
        'u1',
      ),
    ).rejects.toThrow('nuevaTasa no aplica en modo rápido');
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

describe('PrestamosService — renovar (renovación de préstamos)', () => {
  // Préstamo de referencia: 1000 en 12 cuotas, quedan 3 cuotas de RD$100
  // (capital 90 + interés 10 c/u) → saldo aplicado 300, entrega esperada 700.
  const ahora = new Date('2026-08-22T12:00:00.000Z');
  const cuotaPendiente = (numero: number) => ({
    numero,
    pagada: false,
    monto: 100,
    capital: 90,
    interes: 10,
    mora: 0,
    fechaVencimiento: ahora,
  });
  const prestamoBase = {
    id: 'p1',
    empresaId: 'emp1',
    clienteId: 'c1',
    garanteId: null as string | null,
    monto: 1000,
    tasaInteres: 5,
    numeroCuotas: 12,
    frecuenciaPago: 'MENSUAL',
    saldoPendiente: 0,
    estado: 'ACTIVO',
    cuotaMensual: 100,
    fechaInicio: ahora,
    fechaVencimiento: ahora,
    moraAcumulada: 0,
    refinanciado: false,
    vecesRefinanciado: 0,
    cadenaRenovaciones: 0,
    historialRenovacion: null,
    historialRefinanciamiento: null,
    createdAt: ahora,
    cliente: { nombre: 'Juan', apellido: 'Pérez' },
    cuotas: [
      {
        numero: 1,
        pagada: true,
        monto: 100,
        capital: 90,
        interes: 10,
        mora: 0,
      },
      ...[10, 11, 12].map(cuotaPendiente),
    ],
  };
  const configRenovacion = {
    permitirRenovacion: true,
    maxCuotasRestantesParaRenovacion: 0,
    incluirInteresEnRenovacion: true,
    porcentajeMaximoSaldoAplicado: 100,
    maxRenovacionesConsecutivas: 0,
  };

  function buildRenovarMocks(
    opts: {
      config?: Record<string, unknown> | null;
      inicial?: Record<string, unknown>;
      locked?: Record<string, unknown> | null;
      efectivoInicial?: number;
      pagosEfectivo?: number;
      desembolsos?: number;
    } = {},
  ) {
    const {
      config = configRenovacion,
      inicial = prestamoBase,
      locked = {
        ...prestamoBase,
        cuotas: prestamoBase.cuotas.filter((c) => !c.pagada),
      },
      efectivoInicial = 500,
      pagosEfectivo = 300,
      desembolsos = 0,
    } = opts;
    const caja = {
      id: 'caja-1',
      estado: 'ABIERTA',
      montoInicial: efectivoInicial,
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      pago: {
        create: jest.fn().mockResolvedValue({ id: 'pago-1' }),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { montoTotal: pagosEfectivo } }),
      },
      cuota: { updateMany: jest.fn(), createMany: jest.fn() },
      prestamo: {
        findFirst: jest.fn().mockResolvedValue(locked),
        update: jest.fn().mockResolvedValue({ id: 'p1' }),
        create: jest.fn().mockResolvedValue({ id: 'p2' }),
        count: jest.fn().mockResolvedValue(0),
      },
      cajaSesion: {
        findFirst: jest.fn().mockResolvedValue(caja),
        findUnique: jest.fn().mockResolvedValue(caja),
        update: jest.fn(),
      },
      desembolsoCaja: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { monto: desembolsos } }),
        create: jest.fn().mockResolvedValue({ id: 'des-1' }),
      },
      movimientoFinanciero: { create: jest.fn().mockResolvedValue({}) },
    };
    const $transaction = jest
      .fn()
      .mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    const prestamoAnterior = {
      ...prestamoBase,
      estado: 'RENOVADO',
      cliente: {
        ...prestamoBase.cliente,
        id: 'c1',
        cedula: '001',
        telefono: '',
        celular: '',
      },
      cuotas: prestamoBase.cuotas.map((c) => ({ ...c, pagada: true })),
      pagos: [],
      garante: null,
    };
    const prestamoNuevo = {
      ...prestamoBase,
      id: 'p2',
      monto: 1000,
      estado: 'ACTIVO',
      origen: 'RENOVACION',
      renovacionDeId: 'p1',
      cadenaRenovaciones: 1,
      cliente: {
        ...prestamoBase.cliente,
        id: 'c1',
        cedula: '001',
        telefono: '',
        celular: '',
      },
      cuotas: [],
      pagos: [],
      garante: null,
    };
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(inicial)
      .mockResolvedValueOnce(prestamoAnterior)
      .mockResolvedValueOnce(prestamoNuevo);

    const { service, prisma } = buildService(
      {
        prestamo: {
          findFirst,
          count: jest.fn().mockResolvedValue(0),
          update: jest.fn(),
        },
        configuracion: { findUnique: jest.fn().mockResolvedValue(config) },
        cajaSesion: { findFirst: jest.fn() },
        pago: { aggregate: jest.fn() },
        desembolsoCaja: { aggregate: jest.fn(), create: jest.fn() },
        movimientoFinanciero: { create: jest.fn() },
        $transaction,
      },
      { verificar: jest.fn().mockResolvedValue({ advertencia: false }) },
    );
    return { service, prisma, tx };
  }

  const dtoBase = {
    montoNuevo: 1000,
    tasaInteres: 5,
    numeroCuotas: 12,
  };

  it('happy path: aplica 300 al saldo anterior y desembolsa neto 700', async () => {
    const { service, tx } = buildRenovarMocks();

    const res = await service.renovar('p1', dtoBase, 'emp1', 'u1');

    expect(res.desembolsoNeto).toBe(700);
    expect(res.liquidacion).toEqual({
      capital: 270,
      interes: 30,
      mora: 0,
      total: 300,
    });

    // Pata ingreso: Pago con desglose exacto + observación trazable
    const pagoData = (
      tx.pago.create.mock.calls as unknown as Array<
        [{ data: Record<string, unknown> }]
      >
    )[0][0].data;
    expect(pagoData).toMatchObject({
      prestamoId: 'p1',
      montoTotal: 300,
      capital: 270,
      interes: 30,
      mora: 0,
      observacion: 'Aplicación de saldo por renovación',
    });

    // Cuotas viejas marcadas pagadas y préstamo anterior RENOVADO con snapshot
    const updateManyData = (
      tx.cuota.updateMany.mock.calls as unknown as Array<
        [{ where: Record<string, unknown>; data: Record<string, unknown> }]
      >
    )[0][0];
    expect(updateManyData.where).toEqual({ prestamoId: 'p1', pagada: false });
    expect(updateManyData.data.pagada).toBe(true);
    expect(updateManyData.data.fechaPago).toBeInstanceOf(Date);
    const updateCall = (
      tx.prestamo.update.mock.calls as unknown as Array<
        [
          {
            data: {
              estado: string;
              historialRenovacion: Array<{
                saldoAplicado: number;
                cuotasLiquidadas: unknown[];
              }>;
            };
          },
        ]
      >
    )[0][0];
    expect(updateCall.data.estado).toBe('RENOVADO');
    const registro = updateCall.data.historialRenovacion[0];
    expect(registro.saldoAplicado).toBe(300);
    expect(registro.cuotasLiquidadas).toHaveLength(3);

    // Pata egreso: préstamo nuevo vinculado + desembolso completo
    const createData = (
      tx.prestamo.create.mock.calls as unknown as Array<
        [
          {
            data: {
              estado: string;
              origen: string;
              renovacionDeId: string;
              cadenaRenovaciones: number;
            };
          },
        ]
      >
    )[0][0];
    expect(createData.data.estado).toBe('ACTIVO');
    expect(createData.data.origen).toBe('RENOVACION');
    expect(createData.data.renovacionDeId).toBe('p1');
    expect(createData.data.cadenaRenovaciones).toBe(1);
    const desembolsoData = (
      tx.desembolsoCaja.create.mock.calls as unknown as Array<
        [{ data: Record<string, unknown> }]
      >
    )[0][0].data;
    expect(desembolsoData).toMatchObject({ monto: 1000, prestamoId: 'p2' });
    expect(tx.cuota.createMany).toHaveBeenCalledTimes(1);

    // Movimientos financieros: ingreso liquidación + egreso desembolso
    const tipos = (
      tx.movimientoFinanciero.create.mock.calls as unknown as Array<
        [{ data: { tipo: string } }]
      >
    ).map((c) => c[0].data.tipo);
    expect(tipos).toEqual(['PAGO_RECIBIDO', 'DESEMBOLSO']);

    // Caja: totalIngresos += 300 y totalEgresos += 1000 (neto −700 físico)
    const cajaUpdates = (
      tx.cajaSesion.update.mock.calls as unknown as Array<
        [{ where: { id: string }; data: Record<string, unknown> }]
      >
    ).map((c) => c[0].data);
    expect(cajaUpdates).toContainEqual({
      totalIngresos: { increment: 300 },
    });
    expect(cajaUpdates).toContainEqual({
      totalEgresos: { increment: 1000 },
    });
  });

  it('validación de fondos corregida: neto 700 OK con efectivo 800; rechaza si el neto excede lo disponible', async () => {
    // Caja física: inicial 500 + pagos 300 − desembolsos 0 = 800 → neto 700 cabe
    const ok = buildRenovarMocks({ efectivoInicial: 500, pagosEfectivo: 300 });
    await expect(
      ok.service.renovar('p1', dtoBase, 'emp1', 'u1'),
    ).resolves.toBeTruthy();

    // Caja física: inicial 500 + pagos 0 = 500 < neto 700 → rechaza
    const fail = buildRenovarMocks({ efectivoInicial: 500, pagosEfectivo: 0 });
    await expect(
      fail.service.renovar('p1', dtoBase, 'emp1', 'u1'),
    ).rejects.toThrow(/Fondos insuficientes/);
  });

  it('switch maestro apagado → rechaza', async () => {
    const { service } = buildRenovarMocks({
      config: { ...configRenovacion, permitirRenovacion: false },
    });
    await expect(service.renovar('p1', dtoBase, 'emp1', 'u1')).rejects.toThrow(
      /no está habilitada/,
    );
  });

  it('excede cuotas restantes permitidas → rechaza', async () => {
    const { service } = buildRenovarMocks({
      config: { ...configRenovacion, maxCuotasRestantesParaRenovacion: 2 },
    });
    await expect(service.renovar('p1', dtoBase, 'emp1', 'u1')).rejects.toThrow(
      /faltan 2 cuota/,
    );
  });

  it('límite de renovaciones consecutivas alcanzado → rechaza', async () => {
    const { service } = buildRenovarMocks({
      config: { ...configRenovacion, maxRenovacionesConsecutivas: 1 },
      inicial: { ...prestamoBase, cadenaRenovaciones: 1 },
      locked: {
        ...prestamoBase,
        cadenaRenovaciones: 1,
        cuotas: prestamoBase.cuotas.filter((c) => !c.pagada),
      },
    });
    await expect(service.renovar('p1', dtoBase, 'emp1', 'u1')).rejects.toThrow(
      /alcanzó el límite de 1 renovación/,
    );
  });

  it('incluirInteresEnRenovacion=false excluye el interés del cálculo (entrega 730)', async () => {
    const { service } = buildRenovarMocks({
      config: { ...configRenovacion, incluirInteresEnRenovacion: false },
    });
    const res = await service.renovar('p1', dtoBase, 'emp1', 'u1');
    expect(res.liquidacion.interes).toBe(0);
    expect(res.liquidacion.total).toBe(270);
    expect(res.desembolsoNeto).toBe(730);
  });

  it('porcentajeMaximoSaldoAplicado bloqueante: 50% de 500 es 250 pero saldo aplicado es 300 → rechaza', async () => {
    const { service } = buildRenovarMocks({
      config: { ...configRenovacion, porcentajeMaximoSaldoAplicado: 50 },
    });
    await expect(
      service.renovar('p1', { ...dtoBase, montoNuevo: 500 }, 'emp1', 'u1'),
    ).rejects.toThrow(/máximo permitido de 50%/);
  });

  it('montoNuevo ≤ saldo aplicado (entrega neta 0) → rechaza', async () => {
    // Mocks frescos por llamada: el estado del préstamo cambia en cada escenario
    const igual = buildRenovarMocks();
    await expect(
      igual.service.renovar(
        'p1',
        { ...dtoBase, montoNuevo: 300 },
        'emp1',
        'u1',
      ),
    ).rejects.toThrow(/debe ser mayor al saldo anterior aplicado/);

    const menor = buildRenovarMocks();
    await expect(
      menor.service.renovar(
        'p1',
        { ...dtoBase, montoNuevo: 250 },
        'emp1',
        'u1',
      ),
    ).rejects.toThrow(/debe ser mayor al saldo anterior aplicado/);
  });

  it('doble toque: bajo lock el préstamo ya no está activo → rechaza sin crear nada', async () => {
    const { service, tx } = buildRenovarMocks({
      locked: { ...prestamoBase, estado: 'RENOVADO' },
    });
    await expect(service.renovar('p1', dtoBase, 'emp1', 'u1')).rejects.toThrow(
      /ya no es renovable/,
    );
    expect(tx.pago.create).not.toHaveBeenCalled();
    expect(tx.prestamo.create).not.toHaveBeenCalled();
  });

  it('préstamo con mora la incluye siempre en la liquidación', async () => {
    const conMora = {
      ...prestamoBase,
      cuotas: [
        {
          numero: 1,
          pagada: true,
          monto: 100,
          capital: 90,
          interes: 10,
          mora: 0,
        },
        {
          numero: 10,
          pagada: false,
          monto: 110,
          capital: 90,
          interes: 10,
          mora: 10,
        },
        {
          numero: 11,
          pagada: false,
          monto: 100,
          capital: 90,
          interes: 10,
          mora: 0,
        },
        {
          numero: 12,
          pagada: false,
          monto: 100,
          capital: 90,
          interes: 10,
          mora: 0,
        },
      ],
    };
    const cajaMora = { id: 'caja-1', estado: 'ABIERTA', montoInicial: 900 };
    const txMora = {
      $queryRaw: jest.fn(),
      pago: {
        create: jest.fn().mockResolvedValue({ id: 'pago-m' }),
        aggregate: jest.fn().mockResolvedValue({ _sum: { montoTotal: 0 } }),
      },
      cuota: { updateMany: jest.fn(), createMany: jest.fn() },
      prestamo: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(conMora)
          .mockResolvedValue({
            ...conMora,
            estado: 'RENOVADO',
            pagos: [],
            garante: null,
          }),
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'p2' }),
      },
      cajaSesion: {
        findFirst: jest.fn().mockResolvedValue(cajaMora),
        findUnique: jest.fn().mockResolvedValue(cajaMora),
        update: jest.fn(),
      },
      desembolsoCaja: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }),
        create: jest.fn().mockResolvedValue({ id: 'des-m' }),
      },
      movimientoFinanciero: { create: jest.fn() },
    };
    const { service: svcMora } = buildService(
      {
        prestamo: {
          findFirst: jest.fn().mockResolvedValue(conMora),
          count: jest.fn(),
          update: jest.fn(),
        },
        configuracion: {
          findUnique: jest.fn().mockResolvedValue(configRenovacion),
        },
        $transaction: jest
          .fn()
          .mockImplementation((cb: (tx: unknown) => unknown) => cb(txMora)),
      },
      { verificar: jest.fn().mockResolvedValue({ advertencia: false }) },
    );
    const res = await svcMora.renovar('p1', dtoBase, 'emp1', 'u1');
    expect(res.liquidacion.mora).toBe(10);
    expect(res.liquidacion.total).toBe(310);
    expect(res.desembolsoNeto).toBe(690);
  });

  it('modo rápido: genera cuotas planas idénticas a crear rápido y guarda modoRapido/montoTotal (tasa 0 permitida)', async () => {
    const { service, tx } = buildRenovarMocks();
    const dtoRapido = {
      ...dtoBase,
      tasaInteres: 0,
      numeroCuotas: 10,
      modoRapido: true,
      montoTotal: 1200,
    };

    const res = await service.renovar('p1', dtoRapido, 'emp1', 'u1');

    // Liquidación intacta (independiente del modo): saldo 300, entrega 700
    expect(res.desembolsoNeto).toBe(700);

    // Préstamo nuevo: cuotas planas de RD$120 (1200/10), última ajustada
    const createData = tx.prestamo.create.mock.calls[0][0].data;
    expect(createData.modoRapido).toBe(true);
    expect(createData.tasaInteres).toBe(0);
    expect(createData.montoTotal).toBe(1200);
    const cuotas = tx.cuota.createMany.mock.calls[0][0].data;
    expect(cuotas).toHaveLength(10);
    for (const c of cuotas) {
      expect(c.monto).toBe(120);
    }
    expect(
      cuotas.reduce((s: number, c: { capital: number }) => s + c.capital, 0),
    ).toBeCloseTo(1000, 2);

    // Snapshot de auditoría refleja el plan rápido
    expect(createData.historialRenovacion[0].nuevaCuota).toBe(120);
    expect(createData.historialRenovacion[0].nuevoMontoTotal).toBe(1200);
  });

  it('modo rápido sin montoTotal → rechaza con BadRequest', async () => {
    const { service } = buildRenovarMocks();
    const dtoSinTotal = {
      ...dtoBase,
      tasaInteres: 0,
      numeroCuotas: 10,
      modoRapido: true,
    };
    await expect(
      service.renovar('p1', dtoSinTotal, 'emp1', 'u1'),
    ).rejects.toThrow('montoTotal inválido o ausente para modo rápido.');
  });

  it('modo rápido con montoTotal <= montoNuevo → rechaza (total a cobrar debe superar el monto)', async () => {
    const { service } = buildRenovarMocks();
    const dtoInsuficiente = {
      ...dtoBase,
      tasaInteres: 0,
      numeroCuotas: 10,
      modoRapido: true,
      montoTotal: 900,
    };
    await expect(
      service.renovar('p1', dtoInsuficiente, 'emp1', 'u1'),
    ).rejects.toThrow('El total a cobrar debe ser mayor al monto prestado.');
  });
});

describe('PrestamosService — cancelar (máquina de estados + motivo obligatorio)', () => {
  function buildCancelarMocks(estado: string) {
    const prestamo = {
      id: 'p1',
      empresaId: 'emp1',
      monto: 5000,
      estado,
    };
    const actualizado = {
      ...prestamo,
      estado: 'CANCELADO',
      cliente: { nombre: 'Ana', apellido: 'R' },
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      prestamo: {
        findFirst: jest.fn().mockResolvedValue(prestamo),
        update: jest.fn().mockResolvedValue(actualizado),
      },
    };
    const $transaction = jest
      .fn()
      .mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));
    const { service, prisma } = buildService({
      prestamo: { findFirst: jest.fn().mockResolvedValue(prestamo) },
      $transaction,
    });
    return { service, prisma, tx };
  }

  it('rechaza si no se envía motivo (obligatorio)', async () => {
    const { service, tx } = buildCancelarMocks('ACTIVO');

    await expect(service.cancelar('p1', 'emp1', 'u1')).rejects.toThrow(
      'El motivo de la cancelación es obligatorio',
    );
    expect(tx.prestamo.update).not.toHaveBeenCalled();
  });

  it('rechaza si el motivo viene solo en espacios en blanco', async () => {
    const { service, tx } = buildCancelarMocks('ACTIVO');

    await expect(service.cancelar('p1', 'emp1', 'u1', '   ')).rejects.toThrow(
      'El motivo de la cancelación es obligatorio',
    );
    expect(tx.prestamo.update).not.toHaveBeenCalled();
  });

  it('ACTIVO → CANCELADO: permitido, guarda motivoCancelacion recortado y usa lock FOR UPDATE', async () => {
    const { service, tx } = buildCancelarMocks('ACTIVO');

    const res = await service.cancelar(
      'p1',
      'emp1',
      'u1',
      '  Cliente se mudó  ',
    );

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(res.estado).toBe('CANCELADO');
    expect(tx.prestamo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'CANCELADO',
          motivoCancelacion: 'Cliente se mudó',
        }),
      }),
    );
  });

  it('ATRASADO → CANCELADO: permitido', async () => {
    const { service, tx } = buildCancelarMocks('ATRASADO');

    const res = await service.cancelar('p1', 'emp1', 'u1', 'Incobrable');

    expect(res.estado).toBe('CANCELADO');
    expect(tx.prestamo.update).toHaveBeenCalled();
  });

  it.each([
    'SOLICITADO',
    'EN_REVISION',
    'APROBADO',
    'RECHAZADO',
    'PAGADO',
    'RENOVADO',
    'CANCELADO',
  ])(
    '%s → CANCELADO: rechazado por máquina de estados sin tocar BD',
    async (estado) => {
      const { service, tx } = buildCancelarMocks(estado);

      await expect(
        service.cancelar('p1', 'emp1', 'u1', 'motivo válido'),
      ).rejects.toThrow(`No se puede cancelar un préstamo en estado ${estado}`);
      expect(tx.prestamo.update).not.toHaveBeenCalled();
    },
  );

  it('race condition: lectura inicial ACTIVO pero bajo lock ya está PAGADO → rechaza sin actualizar', async () => {
    const inicial = {
      id: 'p1',
      empresaId: 'emp1',
      monto: 1000,
      estado: 'ACTIVO',
    };
    const bajoLock = { ...inicial, estado: 'PAGADO' };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      prestamo: {
        findFirst: jest.fn().mockResolvedValue(bajoLock),
        update: jest.fn(),
      },
    };
    const $transaction = jest
      .fn()
      .mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));
    const { service } = buildService({
      prestamo: { findFirst: jest.fn().mockResolvedValue(inicial) },
      $transaction,
    });

    await expect(
      service.cancelar('p1', 'emp1', 'u1', 'motivo válido'),
    ).rejects.toThrow(/No se puede cancelar un préstamo en estado PAGADO/);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.prestamo.update).not.toHaveBeenCalled();
  });
});

describe('PrestamosService — accionesPrestamo (hard limit del platform)', () => {
  function buildServiceWithAcciones(acciones: {
    cancelar: boolean;
    refinanciar: boolean;
    renovar: boolean;
  }) {
    const permisosService = {
      accionesPrestamoHabilitadas: jest.fn().mockResolvedValue(acciones),
    };
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
      usuario: {
        findUnique: jest.fn().mockResolvedValue({ nombre: 'Sistema' }),
      },
      alerta: { create: jest.fn().mockResolvedValue({ id: 'a1' }) },
      empresa: { findUnique: jest.fn().mockResolvedValue({ id: 'emp1' }) },
      auditoria: { create: jest.fn().mockResolvedValue({ id: 'au1' }) },
      configuracion: { findUnique: jest.fn().mockResolvedValue(null) },
      movimientoFinanciero: { create: jest.fn() },
      pago: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(),
    };
    const quotaService = { validar: jest.fn().mockResolvedValue(true) };
    const service = new PrestamosService(
      prisma as never,
      quotaService as never,
      permisosService as never,
      undefined,
      undefined,
    );
    return { service, prisma, permisosService };
  }

  it('cancelar: rechaza cuando accionesPrestamo.cancelar es false', async () => {
    const { service } = buildServiceWithAcciones({
      cancelar: false,
      refinanciar: true,
      renovar: true,
    });

    await expect(
      service.cancelar('p1', 'emp1', 'u1', 'motivo'),
    ).rejects.toThrow(
      'La cancelación de préstamos no está habilitada para tu empresa.',
    );
  });

  it('cancelar: permite cuando accionesPrestamo.cancelar es true', async () => {
    const prestamo = {
      id: 'p1',
      empresaId: 'emp1',
      monto: 5000,
      estado: 'ACTIVO',
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      prestamo: {
        findFirst: jest.fn().mockResolvedValue(prestamo),
        update: jest.fn().mockResolvedValue({
          ...prestamo,
          estado: 'CANCELADO',
          cliente: { nombre: 'A', apellido: 'B' },
        }),
      },
    };
    const { service, prisma } = buildServiceWithAcciones({
      cancelar: true,
      refinanciar: true,
      renovar: true,
    });
    prisma.prestamo.findFirst.mockResolvedValue(prestamo);
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(tx),
    );

    const res = await service.cancelar('p1', 'emp1', 'u1', 'motivo');
    expect(res.estado).toBe('CANCELADO');
  });

  it('refinanciar: rechaza cuando accionesPrestamo.refinanciar es false', async () => {
    const prestamo = {
      id: 'p1',
      empresaId: 'emp1',
      monto: 5000,
      estado: 'ACTIVO',
      cuotas: [
        { id: 'c1', pagada: false, capital: 1000, interes: 50, numero: 1 },
      ],
      cliente: { nombre: 'A', apellido: 'B' },
      refinanciado: false,
      vecesRefinanciado: 0,
    };
    const { service, prisma } = buildServiceWithAcciones({
      cancelar: true,
      refinanciar: false,
      renovar: true,
    });
    prisma.prestamo.findFirst.mockResolvedValue(prestamo);

    await expect(
      service.refinanciar(
        'p1',
        {
          nuevasCuotas: 6,
          motivo: 'test',
        } as any,
        'emp1',
        'u1',
      ),
    ).rejects.toThrow(
      'El refinanciamiento no está habilitado para tu empresa.',
    );
  });

  it('renovar: rechaza cuando accionesPrestamo.renovar es false', async () => {
    const prestamo = {
      id: 'p1',
      empresaId: 'emp1',
      monto: 5000,
      estado: 'ACTIVO',
      cuotas: [
        { id: 'c1', pagada: false, capital: 1000, interes: 50, numero: 1 },
      ],
      cliente: { nombre: 'A', apellido: 'B' },
      cadenaRenovaciones: 0,
    };
    const { service, prisma } = buildServiceWithAcciones({
      cancelar: true,
      refinanciar: true,
      renovar: false,
    });
    prisma.prestamo.findFirst.mockResolvedValue(prestamo);

    await expect(
      service.renovar(
        'p1',
        {
          montoNuevo: 10000,
          tasaInteres: 5,
          numeroCuotas: 12,
          frecuenciaPago: 'MENSUAL',
          fechaInicio: new Date().toISOString(),
          motivo: 'test',
        } as any,
        'emp1',
        'u1',
      ),
    ).rejects.toThrow('La renovación no está habilitada para tu empresa.');
  });
});
