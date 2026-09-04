import { ReportesService } from './reportes.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('ReportesService', () => {
  describe('estadoGeneral', () => {
    it('los RENOVADO se reportan en su propia clave y no suman a activos ni pagados', async () => {
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
          aggregate: jest.fn().mockResolvedValue({
            _sum: { monto: 50_000, saldoPendiente: 30_000 },
          }),
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

    it('sin préstamos RENOVADO el contador es 0 sin romper', async () => {
      const service = new ReportesService({
        prestamo: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          groupBy: jest.fn().mockResolvedValue([]),
          aggregate: jest
            .fn()
            .mockResolvedValue({ _sum: { monto: null, saldoPendiente: null } }),
        },
      } as unknown as PrismaService);

      const result = await service.estadoGeneral({
        rol: 'ADMIN',
        empresaId: 'emp1',
      });

      expect(result.resumen.renovados).toBe(0);
      expect(result.resumen.totalCartera).toBe(0);
    });

    it('totalCartera viene del aggregate, no de la paginación parcial', async () => {
      const aggregate = jest
        .fn()
        .mockResolvedValueOnce({
          _sum: { monto: 100_000, saldoPendiente: null },
        }) // totalesMonto
        .mockResolvedValueOnce({ _sum: { saldoPendiente: 75_000 } }); // totalesCartera

      const service = new ReportesService({
        prestamo: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          groupBy: jest.fn().mockResolvedValue([]),
          aggregate,
        },
      } as unknown as PrismaService);

      const result = await service.estadoGeneral({
        rol: 'ADMIN',
        empresaId: 'emp1',
      });

      expect(result.resumen.totalCartera).toBe(75_000);
      expect(aggregate).toHaveBeenCalledTimes(2);
    });

    it('rechaza usuarios no ADMIN via permisos (no en service)', async () => {
      // La validación de ADMIN se maneja en el guard @RequierePermiso('reportes:exportar')
      // El service no tiene assertAdmin — verificamos que funcione sin restricción de rol
      const service = new ReportesService({
        prestamo: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          groupBy: jest.fn().mockResolvedValue([]),
          aggregate: jest
            .fn()
            .mockResolvedValueOnce({
              _sum: { monto: null, saldoPendiente: null },
            })
            .mockResolvedValueOnce({ _sum: { saldoPendiente: null } }),
        },
      } as unknown as PrismaService);

      const result = await service.estadoGeneral({
        rol: 'EMPLEADO',
        empresaId: 'emp1',
      });

      expect(result.resumen.activos).toBe(0);
    });
  });

  describe('carteraVencida', () => {
    it('no hace queries redundantes (solo 3 en paralelo)', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const count = jest.fn().mockResolvedValue(0);
      const aggregate = jest
        .fn()
        .mockResolvedValue({ _sum: { monto: 0, moraAcumulada: 0 } });

      const service = new ReportesService({
        prestamo: { findMany, count, aggregate },
      } as unknown as PrismaService);

      await service.carteraVencida({ rol: 'ADMIN', empresaId: 'emp1' });

      expect(findMany).toHaveBeenCalledTimes(1);
      expect(count).toHaveBeenCalledTimes(1);
      expect(aggregate).toHaveBeenCalledTimes(1);
    });

    it('calcula totalMora desde el aggregate (sin query adicional)', async () => {
      const aggregate = jest
        .fn()
        .mockResolvedValue({ _sum: { monto: 50_000, moraAcumulada: 3_500 } });

      const service = new ReportesService({
        prestamo: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          aggregate,
        },
      } as unknown as PrismaService);

      const result = await service.carteraVencida({
        rol: 'ADMIN',
        empresaId: 'emp1',
      });

      expect(result.totalMora).toBe(3_500);
    });

    it('aplica paginación correctamente', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new ReportesService({
        prestamo: {
          findMany,
          count: jest.fn().mockResolvedValue(0),
          aggregate: jest
            .fn()
            .mockResolvedValue({ _sum: { monto: 0, moraAcumulada: 0 } }),
        },
      } as unknown as PrismaService);

      await service.carteraVencida({ empresaId: 'emp1' }, undefined, 3, 25);

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 50, take: 25 }),
      );
    });

    it('filtra por provincia cuando se indica', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new ReportesService({
        prestamo: {
          findMany,
          count: jest.fn().mockResolvedValue(0),
          aggregate: jest
            .fn()
            .mockResolvedValue({ _sum: { monto: 0, moraAcumulada: 0 } }),
        },
      } as unknown as PrismaService);

      await service.carteraVencida({ empresaId: 'emp1' }, 'Santiago');

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cliente: { provincia: 'Santiago' },
          }),
        }),
      );
    });
  });

  describe('pagosPorCliente', () => {
    it('lanza error si el cliente no existe', async () => {
      const service = new ReportesService({
        cliente: { findFirst: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaService);

      await expect(
        service.pagosPorCliente({ empresaId: 'emp1' }, 'cli-1'),
      ).rejects.toThrow('Cliente no encontrado');
    });

    it('lanza error si el cliente pertenece a otra empresa', async () => {
      const service = new ReportesService({
        cliente: { findFirst: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaService);

      await expect(
        service.pagosPorCliente({ empresaId: 'emp1' }, 'cli-2'),
      ).rejects.toThrow('Cliente no encontrado');
    });
  });

  describe('cobrosPorPeriodo', () => {
    it('retorna estructura correcta con totales', async () => {
      const service = new ReportesService({
        pago: {
          findMany: jest.fn().mockResolvedValue([]),
          aggregate: jest.fn().mockResolvedValue({
            _sum: { montoTotal: 0, capital: 0, interes: 0, mora: 0 },
          }),
          count: jest.fn().mockResolvedValue(0),
        },
      } as unknown as PrismaService);

      const result = await service.cobrosPorPeriodo(
        { empresaId: 'emp1' },
        '2026-01-01',
        '2026-01-31',
      );

      expect(result).toHaveProperty('totalCobrado');
      expect(result).toHaveProperty('totalCapital');
      expect(result).toHaveProperty('totalInteres');
      expect(result).toHaveProperty('totalMora');
      expect(result).toHaveProperty('pagos');
      expect(result.totalRegistros).toBe(0);
    });

    it('aplica paginación correctamente', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new ReportesService({
        pago: {
          findMany,
          aggregate: jest.fn().mockResolvedValue({
            _sum: { montoTotal: 0, capital: 0, interes: 0, mora: 0 },
          }),
          count: jest.fn().mockResolvedValue(0),
        },
      } as unknown as PrismaService);

      await service.cobrosPorPeriodo(
        { empresaId: 'emp1' },
        '2026-01-01',
        '2026-01-31',
        undefined,
        2,
        50,
      );

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 50, take: 50 }),
      );
    });

    it('calcula totales con datos reales', async () => {
      const service = new ReportesService({
        pago: {
          findMany: jest.fn().mockResolvedValue([
            {
              createdAt: new Date(),
              prestamo: {
                monto: 10000,
                cliente: {
                  nombre: 'A',
                  apellido: 'B',
                  cedula: '001',
                  provincia: 'SD',
                  municipio: 'DN',
                },
              },
              capital: 8000,
              interes: 1500,
              mora: 500,
              montoTotal: 10000,
              metodo: 'EFECTIVO',
              referencia: null,
              usuario: { nombre: 'Cob' },
            },
          ]),
          aggregate: jest.fn().mockResolvedValue({
            _sum: {
              montoTotal: 10000,
              capital: 8000,
              interes: 1500,
              mora: 500,
            },
          }),
          count: jest.fn().mockResolvedValue(1),
        },
      } as unknown as PrismaService);

      const result = await service.cobrosPorPeriodo(
        { empresaId: 'emp1' },
        '2026-01-01',
        '2026-01-31',
      );

      expect(result.totalCobrado).toBe(10000);
      expect(result.totalCapital).toBe(8000);
      expect(result.totalMora).toBe(500);
      expect(result.pagos).toHaveLength(1);
      expect(result.pagos[0].cliente).toBe('A B');
    });
  });

  describe('reporteCajas', () => {
    it('respeta la paginación de pagos', async () => {
      const findMany = jest
        .fn()
        .mockResolvedValueOnce([]) // cajas
        .mockResolvedValueOnce([]) // pagos (paginados)
        .mockResolvedValueOnce([]); // allPagos (totales)
      const count = jest.fn().mockResolvedValue(0);

      const service = new ReportesService({
        cajaSesion: { findMany },
        pago: { findMany, count },
      } as unknown as PrismaService);

      await service.reporteCajas(
        { empresaId: 'emp1' },
        '2026-01-01',
        '2026-01-31',
        undefined,
        2, // pagina
        50, // porPagina
      );

      const pagosCall = findMany.mock.calls[1][0];
      expect(pagosCall.skip).toBe(50);
      expect(pagosCall.take).toBe(50);
    });

    it('filtra por usuarioId cuando se proporciona', async () => {
      const findMany = jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      const count = jest.fn().mockResolvedValue(0);

      const service = new ReportesService({
        cajaSesion: { findMany },
        pago: { findMany, count },
      } as unknown as PrismaService);

      await service.reporteCajas(
        { empresaId: 'emp1' },
        '2026-01-01',
        '2026-01-31',
        'user-123',
      );

      const cajasCall = findMany.mock.calls[0][0];
      expect(cajasCall.where).toEqual(
        expect.objectContaining({ usuarioId: 'user-123' }),
      );
    });

    it('retorna resumen con totales en 0 sin datos', async () => {
      const service = new ReportesService({
        cajaSesion: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        pago: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
      } as unknown as PrismaService);

      const result = await service.reporteCajas(
        { empresaId: 'emp1' },
        '2026-01-01',
        '2026-01-31',
      );

      expect(result.resumen.totalCobrado).toBe(0);
      expect(result.resumen.cajasCerradas).toBe(0);
      expect(result.resumen.cajasAbiertas).toBe(0);
      expect(result.pagos).toEqual([]);
      expect(result.resumenPorUsuario).toEqual([]);
    });

    it('C agrupa porDia por el createdAt del pago, no por la fecha actual', async () => {
      const fechaPago = '2026-03-15T14:30:00.000Z';
      const findMany = jest
        .fn()
        .mockResolvedValueOnce([]) // cajas
        .mockResolvedValueOnce([]) // pagos paginados
        .mockResolvedValueOnce([
          {
            montoTotal: 100,
            capital: 50,
            interes: 40,
            mora: 10,
            metodo: 'EFECTIVO',
            usuarioId: 'u1',
            createdAt: fechaPago,
          },
        ]); // allPagos
      const count = jest.fn().mockResolvedValue(1);

      const service = new ReportesService({
        cajaSesion: { findMany },
        pago: { findMany, count },
      } as unknown as PrismaService);

      const result = await service.reporteCajas(
        { empresaId: 'emp1' },
        '2026-03-01',
        '2026-03-31',
      );

      expect(result.resumenPorDia).toContainEqual(
        expect.objectContaining({ fecha: '2026-03-15', totalCobrado: 100 }),
      );
      expect(result.resumen.totalCobrado).toBe(100);
      expect(result.resumen.efectivoReal).toBe(0);
    });
  });

  describe('flujoDeCaja', () => {
    it('calcula entradas y salidas correctamente', async () => {
      const service = new ReportesService({
        movimientoFinanciero: { findMany: jest.fn().mockResolvedValue([]) },
        pago: {
          findMany: jest.fn().mockResolvedValue([
            {
              montoTotal: 5000,
              capital: 4000,
              interes: 800,
              mora: 200,
              metodo: 'EFECTIVO',
              createdAt: new Date('2026-03-01T10:00:00Z'),
            },
            {
              montoTotal: 3000,
              capital: 2500,
              interes: 400,
              mora: 100,
              metodo: 'TRANSFERENCIA',
              createdAt: new Date('2026-03-02T14:00:00Z'),
            },
          ]),
        },
        gasto: {
          findMany: jest.fn().mockResolvedValue([
            {
              monto: 1500,
              categoria: 'Oficina',
              fecha: new Date('2026-03-01T12:00:00Z'),
            },
          ]),
        },
        desembolsoCaja: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { monto: 10000, createdAt: new Date('2026-03-01T09:00:00Z') },
            ]),
        },
        inyeccionCapital: { findMany: jest.fn().mockResolvedValue([]) },
        retiroGanancias: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaService);

      const result = await service.flujoDeCaja(
        { empresaId: 'emp1' },
        '2026-03-01',
        '2026-03-31',
      );

      expect(result.totalEntradas).toBe(8000);
      expect(result.totalSalidas).toBe(11500);
      expect(result.neto).toBe(-3500);
      expect(result.desgloseEntradas.pagos).toBe(8000);
      expect(result.desgloseSalidas.desembolsos).toBe(10000);
      expect(result.desgloseSalidas.gastos).toBe(1500);
    });

    it('retorna porDia vacío sin errores con datos vacíos', async () => {
      const service = new ReportesService({
        movimientoFinanciero: { findMany: jest.fn().mockResolvedValue([]) },
        pago: { findMany: jest.fn().mockResolvedValue([]) },
        gasto: { findMany: jest.fn().mockResolvedValue([]) },
        desembolsoCaja: { findMany: jest.fn().mockResolvedValue([]) },
        inyeccionCapital: { findMany: jest.fn().mockResolvedValue([]) },
        retiroGanancias: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaService);

      const result = await service.flujoDeCaja(
        { empresaId: 'emp1' },
        '2026-03-01',
        '2026-03-31',
      );

      expect(result.totalEntradas).toBe(0);
      expect(result.totalSalidas).toBe(0);
      expect(result.neto).toBe(0);
      expect(result.porDia).toEqual([]);
    });

    it('agrupa gastos por categoría correctamente', async () => {
      const service = new ReportesService({
        movimientoFinanciero: { findMany: jest.fn().mockResolvedValue([]) },
        pago: { findMany: jest.fn().mockResolvedValue([]) },
        gasto: {
          findMany: jest.fn().mockResolvedValue([
            { monto: 1000, categoria: 'Alquiler', fecha: new Date() },
            { monto: 500, categoria: 'Servicios', fecha: new Date() },
            { monto: 300, categoria: 'Alquiler', fecha: new Date() },
          ]),
        },
        desembolsoCaja: { findMany: jest.fn().mockResolvedValue([]) },
        inyeccionCapital: { findMany: jest.fn().mockResolvedValue([]) },
        retiroGanancias: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaService);

      const result = await service.flujoDeCaja(
        { empresaId: 'emp1' },
        '2026-03-01',
        '2026-03-31',
      );

      expect(result.gastosPorCategoria).toEqual({
        Alquiler: 1300,
        Servicios: 500,
      });
    });

    it('pasa usuarioId como filtro cuando se proporciona', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new ReportesService({
        pago: { findMany },
        gasto: { findMany: jest.fn().mockResolvedValue([]) },
        desembolsoCaja: { findMany: jest.fn().mockResolvedValue([]) },
        inyeccionCapital: { findMany: jest.fn().mockResolvedValue([]) },
        retiroGanancias: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaService);

      await service.flujoDeCaja(
        { empresaId: 'emp1' },
        '2026-03-01',
        '2026-03-31',
        'user-123',
      );

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ usuarioId: 'user-123' }),
        }),
      );
    });
  });

  describe('desempenoPorCobrador', () => {
    it('agrupa pagos por usuario y calcula promedios', async () => {
      const service = new ReportesService({
        pago: {
          findMany: jest.fn().mockResolvedValue([
            {
              montoTotal: 5000,
              capital: 4000,
              interes: 800,
              mora: 200,
              metodo: 'EFECTIVO',
              createdAt: new Date('2026-03-01T10:00:00Z'),
              usuarioId: 'u1',
              usuario: { id: 'u1', nombre: 'Juan' },
            },
            {
              montoTotal: 3000,
              capital: 2500,
              interes: 400,
              mora: 100,
              metodo: 'TRANSFERENCIA',
              createdAt: new Date('2026-03-01T14:00:00Z'),
              usuarioId: 'u1',
              usuario: { id: 'u1', nombre: 'Juan' },
            },
            {
              montoTotal: 2000,
              capital: 1800,
              interes: 200,
              mora: 0,
              metodo: 'EFECTIVO',
              createdAt: new Date('2026-03-02T09:00:00Z'),
              usuarioId: 'u2',
              usuario: { id: 'u2', nombre: 'María' },
            },
          ]),
        },
      } as unknown as PrismaService);

      const result = await service.desempenoPorCobrador(
        { empresaId: 'emp1' },
        '2026-03-01',
        '2026-03-31',
      );

      expect(result.cobradores).toHaveLength(2);
      expect(result.cobradores[0].nombre).toBe('Juan');
      expect(result.cobradores[0].totalCobrado).toBe(8000);
      expect(result.cobradores[0].cantidadPagos).toBe(2);
      expect(result.cobradores[0].promedioPorPago).toBe(4000);
      expect(result.cobradores[0].diasActivos).toBe(1);
      expect(result.cobradores[1].nombre).toBe('María');
      expect(result.cobradores[1].totalCobrado).toBe(2000);
      expect(result.totalCobrado).toBe(10000);
      expect(result.cantidadPagos).toBe(3);
    });

    it('retorna arrays vacíos sin pagos', async () => {
      const service = new ReportesService({
        pago: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaService);

      const result = await service.desempenoPorCobrador({ empresaId: 'emp1' });

      expect(result.cobradores).toEqual([]);
      expect(result.cantidadPagos).toBe(0);
    });

    it('filtra por usuarioId cuando se proporciona', async () => {
      const findMany = jest.fn().mockResolvedValue([]);

      const service = new ReportesService({
        pago: { findMany },
      } as unknown as PrismaService);

      await service.desempenoPorCobrador(
        { empresaId: 'emp1' },
        undefined,
        undefined,
        'user-123',
      );

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ usuarioId: 'user-123' }),
        }),
      );
    });

    it('calcula promedios correctamente con múltiples pagos', async () => {
      const service = new ReportesService({
        pago: {
          findMany: jest.fn().mockResolvedValue([
            {
              montoTotal: 2000,
              capital: 1500,
              interes: 400,
              mora: 100,
              metodo: 'EFECTIVO',
              createdAt: new Date('2026-03-01T10:00:00Z'),
              usuarioId: 'u1',
              usuario: { id: 'u1', nombre: 'Juan' },
            },
            {
              montoTotal: 4000,
              capital: 3000,
              interes: 800,
              mora: 200,
              metodo: 'EFECTIVO',
              createdAt: new Date('2026-03-01T15:00:00Z'),
              usuarioId: 'u1',
              usuario: { id: 'u1', nombre: 'Juan' },
            },
            {
              montoTotal: 6000,
              capital: 5000,
              interes: 800,
              mora: 200,
              metodo: 'TRANSFERENCIA',
              createdAt: new Date('2026-03-02T10:00:00Z'),
              usuarioId: 'u1',
              usuario: { id: 'u1', nombre: 'Juan' },
            },
          ]),
        },
      } as unknown as PrismaService);

      const result = await service.desempenoPorCobrador(
        { empresaId: 'emp1' },
        '2026-03-01',
        '2026-03-31',
      );

      expect(result.cobradores).toHaveLength(1);
      expect(result.cobradores[0].totalCobrado).toBe(12000);
      expect(result.cobradores[0].promedioPorPago).toBe(4000);
      expect(result.cobradores[0].diasActivos).toBe(2);
      expect(result.cobradores[0].promedioPorDia).toBe(6000);
      expect(result.cobradores[0].pagosPorMetodo.EFECTIVO).toEqual({
        cantidad: 2,
        monto: 6000,
      });
      expect(result.cobradores[0].pagosPorMetodo.TRANSFERENCIA).toEqual({
        cantidad: 1,
        monto: 6000,
      });
    });
  });

  describe('proyeccionCuotas', () => {
    it('agrupa cuotas por mes y marca vencidas', async () => {
      const hoy = new Date();
      const hace10 = new Date(hoy.getTime() - 10 * 86400000);
      const dentroDe30 = new Date(hoy.getTime() + 30 * 86400000);
      const dentroDe60 = new Date(hoy.getTime() + 60 * 86400000);

      const service = new ReportesService({
        prestamo: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'p1',
              cliente: {
                nombre: 'Ana',
                apellido: 'López',
                cedula: '001',
                provincia: 'Santo Domingo',
              },
              cuotas: [
                {
                  numero: 1,
                  monto: 1000,
                  capital: 800,
                  interes: 150,
                  mora: 50,
                  fechaVencimiento: hace10,
                },
                {
                  numero: 2,
                  monto: 1000,
                  capital: 800,
                  interes: 150,
                  mora: 0,
                  fechaVencimiento: dentroDe30,
                },
              ],
            },
            {
              id: 'p2',
              cliente: {
                nombre: 'Carlos',
                apellido: 'Ruiz',
                cedula: '002',
                provincia: 'Santiago',
              },
              cuotas: [
                {
                  numero: 1,
                  monto: 2000,
                  capital: 1600,
                  interes: 300,
                  mora: 100,
                  fechaVencimiento: dentroDe60,
                },
              ],
            },
          ]),
        },
      } as unknown as PrismaService);

      const result = await service.proyeccionCuotas({ empresaId: 'emp1' });

      expect(result.totalPrestamos).toBe(2);
      expect(result.totalCuotasPendientes).toBe(3);
      expect(result.totalMontoPendiente).toBe(4000);
      expect(result.totalVencidas).toBe(1);
      expect(result.porMes.length).toBeGreaterThanOrEqual(2);
    });

    it('retorna vacío sin préstamos activos', async () => {
      const service = new ReportesService({
        prestamo: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaService);

      const result = await service.proyeccionCuotas({ empresaId: 'emp1' });

      expect(result.totalPrestamos).toBe(0);
      expect(result.totalCuotasPendientes).toBe(0);
      expect(result.porMes).toEqual([]);
    });

    it('filtra por provincia cuando se indica', async () => {
      const findMany = jest.fn().mockResolvedValue([]);

      const service = new ReportesService({
        prestamo: { findMany },
      } as unknown as PrismaService);

      await service.proyeccionCuotas({ empresaId: 'emp1' }, 'Santiago');

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cliente: { provincia: 'Santiago' },
          }),
        }),
      );
    });

    it('calcula totalMontoPendiente correctamente', async () => {
      const hoy = new Date();
      const service = new ReportesService({
        prestamo: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'p1',
              cliente: {
                nombre: 'A',
                apellido: 'B',
                cedula: '001',
                provincia: 'SD',
              },
              cuotas: [
                {
                  numero: 1,
                  monto: 5000,
                  capital: 4000,
                  interes: 800,
                  mora: 200,
                  fechaVencimiento: new Date(hoy.getTime() + 30 * 86400000),
                },
                {
                  numero: 2,
                  monto: 5000,
                  capital: 4000,
                  interes: 800,
                  mora: 200,
                  fechaVencimiento: new Date(hoy.getTime() + 60 * 86400000),
                },
              ],
            },
          ]),
        },
      } as unknown as PrismaService);

      const result = await service.proyeccionCuotas({ empresaId: 'emp1' });

      expect(result.totalMontoPendiente).toBe(10000);
      expect(result.totalCuotasPendientes).toBe(2);
      expect(result.porMes).toHaveLength(2);
    });
  });
});
