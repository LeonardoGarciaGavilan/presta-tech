import { DashboardService } from './dashboard.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('DashboardService — saldoPendiente real desde cuotas (1.1)', () => {
  it('obtenerProximasCuotas: saldoPendiente se calcula desde cuotas pendientes (no la columna stale)', async () => {
    const ahora = new Date('2026-08-15T12:00:00.000Z');
    const cuotas = [
      {
        id: 'c1',
        numero: 3,
        monto: 125,
        capital: 100,
        interes: 20,
        mora: 5,
        fechaVencimiento: new Date(ahora.getTime() + 2 * 86_400_000),
        prestamo: {
          id: 'p1',
          cliente: {
            id: 'cli1',
            nombre: 'Ana',
            apellido: 'R',
            telefono: '809-000-0000',
          },
        },
      },
    ];
    const findMany = jest.fn().mockResolvedValue(cuotas);
    const groupBy = jest.fn().mockResolvedValue([
      {
        prestamoId: 'p1',
        _sum: { capital: 200, interes: 40, mora: 5 },
      },
    ]);
    const service = new DashboardService({
      cuota: { findMany, groupBy },
    } as unknown as PrismaService);

    const result = await (service as any).obtenerProximasCuotas('emp1');

    expect(result).toHaveLength(1);
    expect(result[0].prestamo.saldoPendiente).toBe(245);
    expect(result[0].prestamo.id).toBe('p1');
    expect(result[0].prestamo.cliente.nombre).toBe('Ana');
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['prestamoId'],
        where: { prestamoId: { in: ['p1'] }, pagada: false },
        _sum: { capital: true, interes: true, mora: true },
      }),
    );
  });

  it('obtenerProximasCuotas: sin cuotas en la ventana devuelve lista vacía sin consultar groupBy', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const groupBy = jest.fn();
    const service = new DashboardService({
      cuota: { findMany, groupBy },
    } as unknown as PrismaService);

    const result = await (service as any).obtenerProximasCuotas('emp1');

    expect(result).toEqual([]);
    expect(groupBy).not.toHaveBeenCalled();
  });
});
