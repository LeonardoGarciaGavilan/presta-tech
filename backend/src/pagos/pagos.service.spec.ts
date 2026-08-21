import { PagosService } from './pagos.service';
import type { PrismaService } from '../prisma/prisma.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { BadRequestException } from '@nestjs/common';

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    pago: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    cajaSesion: { findFirst: jest.fn().mockResolvedValue({ id: 'caja-1' }) },
    prestamo: { findFirst: jest.fn().mockResolvedValue(null) },
    cuota: { updateMany: jest.fn() },
    movimientoFinanciero: { create: jest.fn() },
    usuario: { findUnique: jest.fn() },
    $transaction: jest.fn(),
    configuracion: { findUnique: jest.fn().mockResolvedValue(null) },
    ...overrides,
  };
  const service = new PagosService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('PagosService — idempotencia (C3)', () => {
  // Shape que devuelve respuestaPagoExistente (incluye las relaciones que usa).
  function buildPagoExistente() {
    const now = new Date('2026-08-01T12:00:00.000Z');
    return {
      id: 'pago-1',
      createdAt: now,
      montoTotal: 120,
      capital: 100,
      interes: 20,
      mora: 0,
      metodo: 'EFECTIVO',
      referencia: null,
      observacion: null,
      prestamo: {
        id: 'p1',
        monto: 1000,
        numeroCuotas: 4,
        frecuenciaPago: 'MENSUAL',
        tasaInteres: 5,
        cuotas: [
          {
            id: 'c1',
            numero: 1,
            monto: 120,
            capital: 100,
            interes: 20,
            mora: 0,
            fechaVencimiento: now,
            pagada: true,
            fechaPago: new Date(now.getTime() - 1000),
          },
        ],
        cliente: { nombre: 'Ana', apellido: 'R', cedula: '000-1' },
      },
      usuario: { nombre: 'Sistema' },
    };
  }

  it('registrarPago: el replay lookup se scopea por empresaId', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({ id: 'pago-1' })
      .mockResolvedValue(buildPagoExistente());
    const { service } = buildService({ pago: { findFirst } });

    const dto: CreatePagoDto = {
      prestamoId: 'p1',
      montoPagado: 120,
      metodo: 'EFECTIVO',
      idempotencyKey: 'idem-x',
    };
    const result = await service.registrarPago(dto, 'emp1', 'u1');

    expect(findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          prestamoId: 'p1',
          idempotencyKey: 'idem-x',
          prestamo: { empresaId: 'emp1' },
        },
        select: { id: true },
      }),
    );
    expect(result.pago.id).toBe('pago-1');
  });

  it('saldarPrestamo: el replay lookup se scopea por empresaId', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({ id: 'pago-1' })
      .mockResolvedValue(buildPagoExistente());
    const { service } = buildService({ pago: { findFirst } });

    const result = await service.saldarPrestamo(
      'p1',
      'emp1',
      'u1',
      'EFECTIVO',
      undefined,
      undefined,
      'idem-x',
    );

    expect(findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          prestamoId: 'p1',
          idempotencyKey: 'idem-x',
          prestamo: { empresaId: 'emp1' },
        },
        select: { id: true },
      }),
    );
    expect(result.pago.id).toBe('pago-1');
  });

  it('saldarPrestamo: colisión P2002 devuelve el pago existente (sin 500)', async () => {
    // Replay check: no existe (se procede). Luego el insert choca contra el
    // constraint único (P2002). El helper recupera el pago por su key.
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(null) // replay check
      .mockResolvedValueOnce({ id: 'pago-1' }) // lookup del helper
      .mockResolvedValue(buildPagoExistente()); // respuestaPagoExistente
    const $transaction = jest.fn().mockRejectedValue({
      code: 'P2002',
      message: 'Unique constraint failed',
    });
    const prestamo = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'p1',
        estado: 'ACTIVO',
        monto: 1000,
        numeroCuotas: 4,
        frecuenciaPago: 'MENSUAL',
        tasaInteres: 5,
        cliente: { nombre: 'Ana', apellido: 'R', cedula: '000-1' },
        cuotas: [
          { id: 'c1', capital: 100, interes: 20, mora: 0, pagada: false },
        ],
      }),
    };
    const { service } = buildService({
      pago: { findFirst },
      $transaction,
      prestamo,
    });

    const result = await service.saldarPrestamo(
      'p1',
      'emp1',
      'u1',
      'EFECTIVO',
      undefined,
      undefined,
      'idem-x',
    );

    expect($transaction).toHaveBeenCalled();
    expect(result.pago.id).toBe('pago-1');
  });

  it('saldarPrestamo: error P2002 sin idempotencyKey se propaga', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const $transaction = jest.fn().mockRejectedValue({
      code: 'P2002',
      message: 'Unique constraint failed',
    });
    const prestamo = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'p1',
        estado: 'ACTIVO',
        monto: 1000,
        numeroCuotas: 4,
        frecuenciaPago: 'MENSUAL',
        tasaInteres: 5,
        cliente: { nombre: 'Ana', apellido: 'R', cedula: '000-1' },
        cuotas: [
          { id: 'c1', capital: 100, interes: 20, mora: 0, pagada: false },
        ],
      }),
    };
    const { service } = buildService({
      pago: { findFirst },
      $transaction,
      prestamo,
    });

    await expect(
      service.saldarPrestamo('p1', 'emp1', 'u1', 'EFECTIVO'),
    ).rejects.toEqual({ code: 'P2002', message: 'Unique constraint failed' });
  });
});

function buildTx({
  cuotasPendientes,
  cuotasPostPago = [],
}: {
  cuotasPendientes: unknown[];
  cuotasPostPago?: unknown[];
}) {
  const queryRaw = jest
    .fn<Promise<unknown[]>, [TemplateStringsArray, ...unknown[]]>()
    .mockResolvedValue([{ id: 'p1' }]);
  const prestamoFindUnique = jest.fn().mockResolvedValue({
    id: 'p1',
    estado: 'ACTIVO',
    monto: 1000,
    numeroCuotas: 4,
    frecuenciaPago: 'MENSUAL',
    tasaInteres: 5,
    cliente: { nombre: 'Ana', apellido: 'R', cedula: '000-1' },
  });
  const cuotaFindMany = jest
    .fn()
    .mockResolvedValueOnce(cuotasPendientes)
    .mockResolvedValue(cuotasPostPago);
  const pagoCreate = jest.fn().mockResolvedValue({
    id: 'pago-1',
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
    metodo: 'EFECTIVO',
    referencia: null,
    observacion: null,
  });
  const tx = {
    $queryRaw: queryRaw,
    prestamo: {
      findUnique: prestamoFindUnique,
      update: jest.fn().mockResolvedValue({}),
    },
    cuota: {
      findMany: cuotaFindMany,
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(0),
    },
    pago: { create: pagoCreate },
    movimientoFinanciero: { create: jest.fn().mockResolvedValue({}) },
    cajaSesion: {
      findFirst: jest.fn().mockResolvedValue({ id: 'caja-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  return { tx, queryRaw, cuotaFindMany, prestamoFindUnique };
}

const cuotaPendiente = {
  id: 'c1',
  numero: 1,
  monto: 120,
  capital: 100,
  interes: 20,
  mora: 0,
  fechaVencimiento: new Date('2026-08-10T00:00:00.000Z'),
};

describe('PagosService — guarda anti doble pago (C5)', () => {
  it('registrarPago: toma lock FOR UPDATE y relee cuotas pendientes bajo el lock', async () => {
    const { tx, queryRaw, cuotaFindMany } = buildTx({
      cuotasPendientes: [cuotaPendiente],
    });
    const $transaction = jest
      .fn()
      .mockImplementation(
        (cb: (tx: Record<string, unknown>) => Promise<unknown>) => cb(tx),
      );
    const prestamo = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'p1',
        estado: 'ACTIVO',
        monto: 1000,
        numeroCuotas: 4,
        frecuenciaPago: 'MENSUAL',
        tasaInteres: 5,
        cuotas: [{ ...cuotaPendiente, pagada: false }],
      }),
    };
    const { service } = buildService({ $transaction, prestamo });

    await service.registrarPago(
      { prestamoId: 'p1', montoPagado: 120, metodo: 'EFECTIVO' },
      'emp1',
      'u1',
    );

    expect(queryRaw).toHaveBeenCalled();
    const sql = String(queryRaw.mock.calls[0][0]);
    expect(sql).toContain('FOR UPDATE');
    expect(cuotaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { prestamoId: 'p1', pagada: false },
      }),
    );
  });

  it('registrarPago: si otro tx concurrente ya pagó la cuota, rechaza (sin doble pago)', async () => {
    const { tx } = buildTx({ cuotasPendientes: [] });
    const $transaction = jest
      .fn()
      .mockImplementation(
        (cb: (tx: Record<string, unknown>) => Promise<unknown>) => cb(tx),
      );
    const prestamo = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'p1',
        estado: 'ACTIVO',
        monto: 1000,
        numeroCuotas: 4,
        frecuenciaPago: 'MENSUAL',
        tasaInteres: 5,
        cuotas: [{ ...cuotaPendiente, pagada: false }],
      }),
    };
    const { service } = buildService({ $transaction, prestamo });

    await expect(
      service.registrarPago(
        { prestamoId: 'p1', montoPagado: 120, metodo: 'EFECTIVO' },
        'emp1',
        'u1',
      ),
    ).rejects.toThrow('No hay cuotas pendientes en este préstamo');
    expect(tx.pago.create).not.toHaveBeenCalled();
  });

  it('registrarPago: cuota específica ya pagada por otro tx, rechaza (antes re-pagaba)', async () => {
    // La lectura pre-tx (obsoleta) muestra c1 y c2 pendientes; bajo el lock
    // solo c2 sigue pendiente. Pagar la cuota c1 ya cubierta debe fallar.
    const { tx } = buildTx({
      cuotasPendientes: [
        {
          ...cuotaPendiente,
          id: 'c2',
          numero: 2,
        },
      ],
    });
    const $transaction = jest
      .fn()
      .mockImplementation(
        (cb: (tx: Record<string, unknown>) => Promise<unknown>) => cb(tx),
      );
    const prestamo = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'p1',
        estado: 'ACTIVO',
        monto: 1000,
        numeroCuotas: 4,
        frecuenciaPago: 'MENSUAL',
        tasaInteres: 5,
        cuotas: [
          { ...cuotaPendiente, pagada: false },
          { ...cuotaPendiente, id: 'c2', numero: 2, pagada: false },
        ],
      }),
    };
    const { service } = buildService({ $transaction, prestamo });

    await expect(
      service.registrarPago(
        {
          prestamoId: 'p1',
          montoPagado: 120,
          metodo: 'EFECTIVO',
          cuotaId: 'c1',
        },
        'emp1',
        'u1',
      ),
    ).rejects.toThrow('La cuota especificada no existe o ya fue pagada');
    expect(tx.pago.create).not.toHaveBeenCalled();
  });

  it('saldarPrestamo: si otro tx concurrente ya saldó el préstamo, rechaza', async () => {
    const queryRaw = jest
      .fn<Promise<unknown[]>, [TemplateStringsArray, ...unknown[]]>()
      .mockResolvedValue([{ id: 'p1' }]);
    const pagoCreate = jest.fn();
    const tx = {
      $queryRaw: queryRaw,
      prestamo: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'p1',
          estado: 'PAGADO',
          monto: 1000,
          numeroCuotas: 4,
          frecuenciaPago: 'MENSUAL',
          tasaInteres: 5,
          cliente: { nombre: 'Ana', apellido: 'R', cedula: '000-1' },
          cuotas: [],
        }),
        update: jest.fn(),
      },
      pago: { create: pagoCreate },
      cuota: { updateMany: jest.fn() },
      movimientoFinanciero: { create: jest.fn() },
      cajaSesion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'caja-1' }),
        update: jest.fn(),
      },
    };
    const $transaction = jest
      .fn()
      .mockImplementation(
        (cb: (tx: Record<string, unknown>) => Promise<unknown>) => cb(tx),
      );
    const prestamo = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'p1',
        estado: 'ACTIVO',
        monto: 1000,
        numeroCuotas: 4,
        frecuenciaPago: 'MENSUAL',
        tasaInteres: 5,
        cliente: { nombre: 'Ana', apellido: 'R', cedula: '000-1' },
        cuotas: [
          { id: 'c1', capital: 100, interes: 20, mora: 0, pagada: false },
        ],
      }),
    };
    const { service } = buildService({ $transaction, prestamo });

    await expect(
      service.saldarPrestamo('p1', 'emp1', 'u1', 'EFECTIVO'),
    ).rejects.toThrow('Este préstamo ya está completamente pagado');
    expect(pagoCreate).not.toHaveBeenCalled();
  });
});

describe('PagosService — C7 (concurrencia y replay)', () => {
  function buildSaldoExistente() {
    const now = new Date('2026-08-01T12:00:00.000Z');
    return {
      id: 'pago-saldo',
      createdAt: now,
      montoTotal: 500,
      capital: 400,
      interes: 100,
      mora: 0,
      metodo: 'EFECTIVO',
      referencia: null,
      observacion: 'Saldo total del préstamo',
      prestamo: {
        id: 'p1',
        monto: 1000,
        numeroCuotas: 4,
        frecuenciaPago: 'MENSUAL',
        tasaInteres: 5,
        cuotas: [
          {
            id: 'c1',
            numero: 1,
            monto: 120,
            capital: 100,
            interes: 20,
            mora: 0,
            fechaVencimiento: now,
            pagada: true,
            fechaPago: new Date(now.getTime() - 500),
          },
          {
            id: 'c2',
            numero: 2,
            monto: 120,
            capital: 100,
            interes: 20,
            mora: 0,
            fechaVencimiento: now,
            pagada: true,
            fechaPago: new Date(now.getTime() - 500),
          },
        ],
        cliente: { nombre: 'Ana', apellido: 'R', cedula: '000-1' },
      },
      usuario: { nombre: 'Sistema' },
    };
  }

  it('C7a: doble envío concurrente — el tx que pierde el lock relee estado ya aplicado y hace replay (no 400)', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(null) // replay check
      .mockResolvedValueOnce({ id: 'pago-1' }) // lookup del helper
      .mockResolvedValue({
        id: 'pago-1',
        createdAt: new Date('2026-08-01T12:00:00.000Z'),
        montoTotal: 120,
        capital: 100,
        interes: 20,
        mora: 0,
        metodo: 'EFECTIVO',
        referencia: null,
        observacion: null,
        prestamo: {
          id: 'p1',
          monto: 1000,
          numeroCuotas: 4,
          frecuenciaPago: 'MENSUAL',
          tasaInteres: 5,
          cuotas: [
            {
              id: 'c1',
              numero: 1,
              monto: 120,
              capital: 100,
              interes: 20,
              mora: 0,
              fechaVencimiento: new Date('2026-08-10T00:00:00.000Z'),
              pagada: true,
              fechaPago: new Date('2026-08-01T12:00:00.000Z'),
            },
          ],
          cliente: { nombre: 'Ana', apellido: 'R', cedula: '000-1' },
        },
        usuario: { nombre: 'Sistema' },
      });
    const $transaction = jest
      .fn()
      .mockRejectedValue(
        new BadRequestException(
          'La cuota especificada no existe o ya fue pagada',
        ),
      );
    const prestamo = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'p1',
        estado: 'ACTIVO',
        monto: 1000,
        numeroCuotas: 4,
        frecuenciaPago: 'MENSUAL',
        tasaInteres: 5,
        cuotas: [
          {
            id: 'c1',
            monto: 120,
            capital: 100,
            interes: 20,
            mora: 0,
            pagada: false,
          },
        ],
      }),
    };
    const { service } = buildService({
      pago: { findFirst },
      $transaction,
      prestamo,
    });

    const result = await service.registrarPago(
      {
        prestamoId: 'p1',
        montoPagado: 120,
        metodo: 'EFECTIVO',
        idempotencyKey: 'idem-x',
      },
      'emp1',
      'u1',
    );

    expect(result.pago.id).toBe('pago-1');
  });

  it('C7b: registrarPago rechaza si la caja se cerró tras la validación pre-tx (revalidación bajo lock)', async () => {
    const { tx } = buildTx({
      cuotasPendientes: [cuotaPendiente],
    });
    tx.cajaSesion.findFirst.mockResolvedValue(null);
    const $transaction = jest
      .fn()
      .mockImplementation(
        (cb: (tx: Record<string, unknown>) => Promise<unknown>) => cb(tx),
      );
    const prestamo = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'p1',
        estado: 'ACTIVO',
        monto: 1000,
        numeroCuotas: 4,
        frecuenciaPago: 'MENSUAL',
        tasaInteres: 5,
        cuotas: [{ ...cuotaPendiente, pagada: false }],
      }),
    };
    const { service } = buildService({ $transaction, prestamo });

    await expect(
      service.registrarPago(
        { prestamoId: 'p1', montoPagado: 120, metodo: 'EFECTIVO' },
        'emp1',
        'u1',
      ),
    ).rejects.toThrow('Debes abrir tu caja antes de registrar pagos');
    expect(tx.pago.create).not.toHaveBeenCalled();
  });

  it('C7c: el excedente cubre mora+interés de cuotas futuras e incluye la mora en el monto', async () => {
    const cuotaFuturaConMora = {
      id: 'c2',
      numero: 2,
      monto: 150,
      capital: 100,
      interes: 30,
      mora: 20,
      fechaVencimiento: new Date('2026-09-10T00:00:00.000Z'),
    };
    const { tx } = buildTx({
      cuotasPendientes: [
        { ...cuotaPendiente, pagada: false },
        { ...cuotaFuturaConMora, pagada: false },
      ],
      cuotasPostPago: [
        { ...cuotaFuturaConMora, mora: 0, interes: 20, pagada: false },
      ],
    });
    const $transaction = jest
      .fn()
      .mockImplementation(
        (cb: (tx: Record<string, unknown>) => Promise<unknown>) => cb(tx),
      );
    const prestamo = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'p1',
        estado: 'ACTIVO',
        monto: 1000,
        numeroCuotas: 4,
        frecuenciaPago: 'MENSUAL',
        tasaInteres: 5,
        cliente: { nombre: 'Ana', apellido: 'R', cedula: '000-1' },
        cuotas: [
          { ...cuotaPendiente, pagada: false },
          { ...cuotaFuturaConMora, pagada: false },
        ],
      }),
    };
    const { service } = buildService({ $transaction, prestamo });

    // Pago de c1 (montoExacto 120) con 150 → excedente de 30 que debe cubrir
    // la mora (20) de c2 y el resto (10) su interés. c2 queda con interes 20.
    await service.registrarPago(
      { prestamoId: 'p1', montoPagado: 150, metodo: 'EFECTIVO' },
      'emp1',
      'u1',
    );

    const c2Update = tx.cuota.update.mock.calls.find(
      ([args]: [{ where: { id: string } }]) => args.where.id === 'c2',
    );
    expect(c2Update).toBeDefined();
    expect(c2Update[0].data).toMatchObject({
      capital: 100,
      interes: 20,
      mora: 0,
      monto: 120,
    });
  });

  it('C7d: el replay de un saldo devuelve cuota: null', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({ id: 'pago-saldo' })
      .mockResolvedValue(buildSaldoExistente());
    const { service } = buildService({ pago: { findFirst } });

    const result = await service.saldarPrestamo(
      'p1',
      'emp1',
      'u1',
      'EFECTIVO',
      undefined,
      undefined,
      'idem-saldo',
    );

    expect(result.pago.id).toBe('pago-saldo');
    expect(result.cuota).toBeNull();
  });
});

describe('PagosService — saldoPendiente real desde cuotas (1.1)', () => {
  it('findAll: devuelve saldoPendiente calculado de las cuotas pendientes (no la columna)', async () => {
    const pagos = [
      {
        id: 'pago-1',
        montoTotal: 120,
        prestamo: { id: 'p1', monto: 1000 },
        usuario: { nombre: 'Ana' },
      },
      {
        id: 'pago-2',
        montoTotal: 300,
        prestamo: { id: 'p2', monto: 2000 },
        usuario: { nombre: 'Ana' },
      },
    ];
    const findMany = jest.fn().mockResolvedValue(pagos);
    const groupBy = jest.fn().mockResolvedValue([
      {
        prestamoId: 'p1',
        _sum: { capital: 600, interes: 120, mora: 30 },
      },
    ]);
    const { service } = buildService({
      pago: { findMany },
      cuota: { groupBy },
    });

    const result = await service.findAll('emp1');

    expect(result).toHaveLength(2);
    expect(result[0].prestamo.saldoPendiente).toBe(750);
    // Sin cuotas pendientes registradas → 0
    expect(result[1].prestamo.saldoPendiente).toBe(0);
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['prestamoId'],
        where: { prestamoId: { in: ['p1', 'p2'] }, pagada: false },
        _sum: { capital: true, interes: true, mora: true },
      }),
    );
  });

  it('findAll: sin pagos no consulta groupBy y devuelve lista vacía', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const groupBy = jest.fn();
    const { service } = buildService({
      pago: { findMany },
      cuota: { groupBy },
    });

    const result = await service.findAll('emp1');

    expect(result).toEqual([]);
    expect(groupBy).not.toHaveBeenCalled();
  });
});
