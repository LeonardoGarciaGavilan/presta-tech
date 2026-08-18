jest.mock('../notificaciones/push-notifications.service', () => ({
  PushNotificationsService: class {},
}));

import { PrestamosService } from './prestamos.service';

function buildService(overrides: Record<string, unknown> = {}) {
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
  const quotaService = { validar: jest.fn().mockResolvedValue(true) };
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
        { numero: 1, pagada: true, monto: 120, capital: 100, interes: 20, mora: 0 },
        { numero: 2, pagada: true, monto: 120, capital: 100, interes: 20, mora: 0 },
        { numero: 3, pagada: false, monto: 125, capital: 100, interes: 20, mora: 5 },
        { numero: 4, pagada: false, monto: 120, capital: 100, interes: 20, mora: 0 },
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
    const update = jest.fn().mockRejectedValue(
      new PrismaClientKnownRequestError('No Alerta found', 'P2025'),
    );
    const { service } = buildService({ alerta: { update } });

    await expect(service.marcarAlertaLeida('alerta-otro-tenant', 'emp_A')).rejects.toThrow();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'alerta-otro-tenant', empresaId: 'emp_A' },
      data: { leida: true },
    });
  });
});
