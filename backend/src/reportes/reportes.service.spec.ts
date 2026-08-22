import { ReportesService } from './reportes.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('ReportesService — resumen cuenta renovados aparte', () => {
  it('estadoGeneral: los RENOVADO se reportan en su propia clave y no suman a activos ni pagados', async () => {
    const groupBy = jest.fn().mockResolvedValue([
      { estado: 'ACTIVO', _count: 2 },
      { estado: 'ATRASADO', _count: 1 },
      { estado: 'RENOVADO', _count: 3 },
      { estado: 'PAGADO', _count: 4 },
      { estado: 'CANCELADO', _count: 1 },
    ]);
    const service = new ReportesService({
      prestamo: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(11),
        groupBy,
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 50_000 } }),
      },
    } as unknown as PrismaService);

    const result = await service.estadoGeneral({
      rol: 'ADMIN',
      empresaId: 'emp1',
    });

    expect(result.resumen).toMatchObject({
      activos: 2,
      atrasados: 1,
      pagados: 4,
      renovados: 3,
      cancelados: 1,
    });
  });

  it('estadoGeneral: sin préstamos RENOVADO el contador es 0 sin romper', async () => {
    const service = new ReportesService({
      prestamo: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: null } }),
      },
    } as unknown as PrismaService);

    const result = await service.estadoGeneral({
      rol: 'ADMIN',
      empresaId: 'emp1',
    });

    expect(result.resumen.renovados).toBe(0);
    expect(result.resumen.totalCartera).toBe(0);
  });

  it('estadoGeneral: rechaza usuarios no ADMIN', async () => {
    const service = new ReportesService({
      prestamo: {},
    } as unknown as PrismaService);

    await expect(
      service.estadoGeneral({ rol: 'EMPLEADO', empresaId: 'emp1' }),
    ).rejects.toThrow('Solo el administrador puede generar reportes');
  });
});
