import {
  calcularAmortizacionLocal,
  construirPrestamoRefinanciadoLocal,
  calcularRenovacionLocal,
  siguienteFecha,
} from "@/utils/amortizacion";
import type { Prestamo } from "@/types/prestamo.types";

const dosDecimales = (n: number) =>
  Math.abs(Math.round(n * 100) - n * 100) < 1e-6;

describe("calcularAmortizacionLocal (paridad con backend)", () => {
  it("cuota fija redondeada a 2 decimales y tabla que amortiza exacto", () => {
    const tabla = calcularAmortizacionLocal(
      1000,
      5,
      3,
      "MENSUAL",
      "2026-01-05",
    );

    expect(tabla.cuotas).toHaveLength(3);
    // Todos los montos con máximo 2 decimales (paridad con redondeo backend)
    for (const c of tabla.cuotas) {
      expect(dosDecimales(c.monto)).toBe(true);
      expect(dosDecimales(c.capital)).toBe(true);
      expect(dosDecimales(c.interes)).toBe(true);
    }
    // El capital suma exactamente el monto refinanciado
    const sumaCapital = tabla.cuotas.reduce((s, c) => s + c.capital, 0);
    expect(Math.round(sumaCapital * 100) / 100).toBe(1000);
    // montoTotal = monto + intereses
    const sumaMontos = tabla.cuotas.reduce((s, c) => s + c.monto, 0);
    expect(tabla.montoTotal).toBe(Math.round(sumaMontos * 100) / 100);
    // cuotaInicial = primera cuota
    expect(tabla.cuotaInicial).toBe(tabla.cuotas[0].monto);
  });

  it("tasa 0 divide sin interés", () => {
    const tabla = calcularAmortizacionLocal(300, 0, 3, "SEMANAL");
    expect(tabla.totalIntereses).toBe(0);
    expect(tabla.cuotas.every((c) => c.interes === 0)).toBe(true);
    expect(tabla.cuotas.reduce((s, c) => s + c.capital, 0)).toBe(300);
  });

  it("fechas de vencimiento avanzan según frecuencia", () => {
    const semanal = calcularAmortizacionLocal(
      100,
      5,
      2,
      "SEMANAL",
      "2026-01-05",
    );
    expect(semanal.cuotas[0].fechaVencimiento).toBe("2026-01-12");
    expect(semanal.cuotas[1].fechaVencimiento).toBe("2026-01-19");
  });
});

describe("siguienteFecha", () => {
  it("mensual clampea al último día del mes cuando el día no existe", () => {
    const base = new Date(2026, 0, 31); // 31 ene 2026
    const res = siguienteFecha(base, "MENSUAL", 1);
    expect(res.toISOString().split("T")[0]).toBe("2026-02-28");
  });

  it("quincenal avanza 15 días", () => {
    const base = new Date(2026, 0, 5);
    expect(
      siguienteFecha(base, "QUINCENAL", 1).toISOString().split("T")[0],
    ).toBe("2026-01-20");
  });
});

describe("construirPrestamoRefinanciadoLocal", () => {
  const ahora = new Date("2026-08-10T15:00:00.000Z");

  function buildPrestamo(): Prestamo {
    return {
      id: "p1",
      monto: 400,
      tasaInteres: 5,
      numeroCuotas: 4,
      montoTotal: 480,
      saldoPendiente: 0,
      cuotaMensual: 120,
      frecuenciaPago: "MENSUAL",
      fechaInicio: "2026-05-01",
      fechaVencimiento: "2026-09-01",
      moraAcumulada: 25,
      estado: "ATRASADO",
      refinanciado: false,
      vecesRefinanciado: 0,
      historialRefinanciamiento: null,
      motivoRechazo: null,
      solicitadoPor: null,
      aprobadoPor: null,
      fechaAprobacion: null,
      fechaDesembolso: null,
      modoRapido: false,
      createdAt: "2026-05-01",
      empresaId: "emp1",
      clienteId: "cl1",
      garanteId: null,
      cliente: {
        id: "cl1",
        nombre: "Ana",
        apellido: "R",
        cedula: "000-1",
        telefono: null,
        celular: null,
      },
      cuotas: [
        {
          id: "c1",
          numero: 1,
          monto: 120,
          capital: 100,
          interes: 20,
          mora: 0,
          fechaVencimiento: "2026-06-01",
          pagada: true,
          fechaPago: "2026-06-01",
          createdAt: "2026-05-01",
          prestamoId: "p1",
        },
        {
          id: "c2",
          numero: 2,
          monto: 120,
          capital: 100,
          interes: 20,
          mora: 0,
          fechaVencimiento: "2026-07-01",
          pagada: true,
          fechaPago: "2026-07-01",
          createdAt: "2026-05-01",
          prestamoId: "p1",
        },
        {
          id: "c3",
          numero: 3,
          monto: 125,
          capital: 100,
          interes: 20,
          mora: 5,
          fechaVencimiento: "2026-08-01",
          pagada: false,
          fechaPago: null,
          createdAt: "2026-05-01",
          prestamoId: "p1",
        },
        {
          id: "c4",
          numero: 4,
          monto: 120,
          capital: 100,
          interes: 20,
          mora: 0,
          fechaVencimiento: "2026-09-01",
          pagada: false,
          fechaPago: null,
          createdAt: "2026-05-01",
          prestamoId: "p1",
        },
      ],
      pagos: [],
    } as Prestamo;
  }

  it("replica el refinanciamiento del backend: saldo sin interés, numeración y flags", () => {
    const { prestamo: r, saldoRefinanciado } =
      construirPrestamoRefinanciadoLocal(
        buildPrestamo(),
        { nuevasCuotas: 4, nuevaTasa: 6 },
        ahora,
      );

    // Saldo = capital+mora pendientes (interés excluido): (100+5) + (100+0) = 205
    expect(saldoRefinanciado).toBe(205);

    expect(r.estado).toBe("ACTIVO");
    expect(r.tasaInteres).toBe(6);
    expect(r.numeroCuotas).toBe(6); // última pagada (2) + 4 nuevas
    expect(r.refinanciado).toBe(true);
    expect(r.vecesRefinanciado).toBe(1);
    expect(r.moraAcumulada).toBe(0);
    expect(r.esOffline).toBe(true);

    // Cuotas: 2 pagadas conservadas + 4 nuevas numeradas 3..6 sin mora
    expect(r.cuotas).toHaveLength(6);
    const nuevas = r.cuotas.filter((c) => !c.pagada);
    expect(nuevas.map((c) => c.numero)).toEqual([3, 4, 5, 6]);
    expect(nuevas.every((c) => c.mora === 0 && c.fechaPago === null)).toBe(
      true,
    );
    expect(nuevas.every((c) => c.prestamoId === "p1")).toBe(true);

    // La nueva tabla amortiza el saldo refinanciado
    const sumaCapitalNueva = nuevas.reduce((s, c) => s + c.capital, 0);
    expect(Math.round(sumaCapitalNueva * 100) / 100).toBe(205);
    expect(r.cuotaMensual).toBe(nuevas[0].monto);
  });

  it("respeta nuevaFrecuencia y nuevaFechaPago (primera cuota vence en la fecha indicada)", () => {
    const { prestamo: r } = construirPrestamoRefinanciadoLocal(
      buildPrestamo(),
      {
        nuevasCuotas: 3,
        nuevaTasa: 5,
        nuevaFrecuencia: "QUINCENAL",
        nuevaFechaPago: "2026-09-10",
      },
      ahora,
    );

    expect(r.frecuenciaPago).toBe("QUINCENAL");
    const primerasPendientes = r.cuotas.filter((c) => !c.pagada);
    // Base = 2026-09-10 - 15 días = 2026-08-26; primera cuota = base + 15
    expect(primerasPendientes[0].fechaVencimiento).toBe("2026-09-10");
    expect(primerasPendientes[1].fechaVencimiento).toBe("2026-09-25");
  });

  it("sin cambios de frecuencia/fecha mantiene la frecuencia original", () => {
    const { prestamo: r } = construirPrestamoRefinanciadoLocal(
      buildPrestamo(),
      { nuevasCuotas: 2, nuevaTasa: 7 },
      ahora,
    );
    expect(r.frecuenciaPago).toBe("MENSUAL");
  });
});

describe("calcularRenovacionLocal (paridad con backend)", () => {
  const ahora = new Date("2026-08-22T15:00:00.000Z");

  // Espejo del fixture del happy path del backend: préstamo 1000 con
  // 9 cuotas pagadas y 3 pendientes (270 capital + 30 interés por grupo).
  function buildPrestamoRenovable(): Prestamo {
    const cuotas = [];
    for (let i = 1; i <= 12; i++) {
      const pagada = i <= 9;
      cuotas.push({
        id: `c${i}`,
        numero: i,
        monto: 130,
        capital: 100,
        interes: 30,
        mora: 0,
        fechaVencimiento: `2026-0${Math.min(9, i)}-${String(i).padStart(2, "0")}`,
        pagada,
        fechaPago: pagada ? "2026-01-01" : null,
        createdAt: "2026-01-01",
        prestamoId: "p1",
      });
    }
    return {
      id: "p1",
      monto: 1000,
      tasaInteres: 5,
      numeroCuotas: 12,
      montoTotal: 1560,
      saldoPendiente: 900,
      cuotaMensual: 130,
      frecuenciaPago: "MENSUAL",
      fechaInicio: "2026-01-01",
      fechaVencimiento: "2027-01-01",
      moraAcumulada: 0,
      estado: "ACTIVO",
      refinanciado: false,
      vecesRefinanciado: 0,
      historialRefinanciamiento: null,
      motivoRechazo: null,
      solicitadoPor: null,
      aprobadoPor: null,
      fechaAprobacion: null,
      fechaDesembolso: null,
      modoRapido: false,
      createdAt: "2026-01-01",
      empresaId: "emp1",
      clienteId: "cl1",
      garanteId: null,
      cliente: {
        id: "cl1",
        nombre: "Ana",
        apellido: "R",
        cedula: "000-1",
        telefono: null,
        celular: null,
      },
      cuotas,
      pagos: [],
    } as Prestamo;
  }

  it("liquidación desglosada y desembolso neto idénticos al backend (aplica 300, entrega 700)", () => {
    const res = calcularRenovacionLocal(
      buildPrestamoRenovable(),
      { montoNuevo: 1000, tasaInteres: 5, numeroCuotas: 12 },
      {},
      ahora,
    );

    expect(res.error).toBeNull();
    // 3 cuotas pendientes × (100 capital + 30 interés) = 390 aplicado
    expect(res.liquidacion.capital).toBe(300);
    expect(res.liquidacion.interes).toBe(90);
    expect(res.liquidacion.mora).toBe(0);
    expect(res.liquidacion.total).toBe(390);
    expect(res.desembolsoNeto).toBe(610);
    expect(res.nuevaCuota).toBe(
      calcularAmortizacionLocal(1000, 5, 12, "MENSUAL", ahora.toISOString())
        .cuotaInicial,
    );
    expect(res.tablaNueva.cuotas).toHaveLength(12);
  });

  it("incluirInteres=false excluye el interés futuro como el backend", () => {
    const p = buildPrestamoRenovable();
    const con = calcularRenovacionLocal(
      p,
      { montoNuevo: 1000, tasaInteres: 5, numeroCuotas: 12 },
      {},
      ahora,
    );
    const sin = calcularRenovacionLocal(
      p,
      { montoNuevo: 1000, tasaInteres: 5, numeroCuotas: 12 },
      { incluirInteres: false },
      ahora,
    );
    expect(sin.liquidacion.interes).toBe(0);
    expect(sin.liquidacion.total).toBeCloseTo(
      con.liquidacion.total - con.liquidacion.interes,
      2,
    );
    expect(sin.desembolsoNeto).toBeCloseTo(
      con.desembolsoNeto + con.liquidacion.interes,
      2,
    );
    expect(sin.error).toBeNull();
  });

  it("la mora se incluye siempre en la liquidación", () => {
    const p = buildPrestamoRenovable();
    p.cuotas = p.cuotas.map((c) =>
      !c.pagada && c.numero === 10 ? { ...c, mora: 10 } : c,
    );
    const base = calcularRenovacionLocal(
      p,
      { montoNuevo: 1000, tasaInteres: 5, numeroCuotas: 12 },
      {},
      ahora,
    );
    const conMora = calcularRenovacionLocal(
      p,
      { montoNuevo: 1000, tasaInteres: 5, numeroCuotas: 12 },
      {},
      ahora,
    );
    expect(base.liquidacion.mora).toBe(10);
    expect(conMora.liquidacion.mora).toBe(10);
  });

  it("rechaza entrega cero: montoNuevo ≤ saldo aplicado", () => {
    const p = buildPrestamoRenovable();
    const res = calcularRenovacionLocal(
      p,
      { montoNuevo: 200, tasaInteres: 5, numeroCuotas: 12 },
      {},
      ahora,
    );
    expect(res.error).toContain("mayor al saldo anterior");
  });

  it("porcentajeMaximoSaldoAplicado bloqueante igual que el backend", () => {
    const p = buildPrestamoRenovable();
    // saldo aplicado = 390; con 50% el mínimo de monto nuevo es 780
    const ok = calcularRenovacionLocal(
      p,
      { montoNuevo: 800, tasaInteres: 5, numeroCuotas: 12 },
      { porcentajeMaximoSaldoAplicado: 50 },
      ahora,
    );
    const bloqueado = calcularRenovacionLocal(
      p,
      { montoNuevo: 500, tasaInteres: 5, numeroCuotas: 12 },
      { porcentajeMaximoSaldoAplicado: 50 },
      ahora,
    );
    expect(ok.error).toBeNull();
    expect(bloqueado.error).toContain("50%");
  });

  it("sin cuotas pendientes reporta que no es renovable", () => {
    const p = buildPrestamoRenovable();
    p.cuotas = p.cuotas.map((c) => ({ ...c, pagada: true }));
    const res = calcularRenovacionLocal(
      p,
      { montoNuevo: 1000, tasaInteres: 5, numeroCuotas: 12 },
      {},
      ahora,
    );
    expect(res.error).toContain("no tiene cuotas pendientes");
  });

  it("hereda la frecuencia del préstamo cuando el DTO no la envía", () => {
    const p = buildPrestamoRenovable();
    p.frecuenciaPago = "SEMANAL";
    const res = calcularRenovacionLocal(
      p,
      { montoNuevo: 1000, tasaInteres: 5, numeroCuotas: 10 },
      {},
      ahora,
    );
    expect(res.tablaNueva.cuotas[0].fechaVencimiento).toBe(
      calcularAmortizacionLocal(1000, 5, 10, "SEMANAL", ahora.toISOString())
        .cuotas[0].fechaVencimiento,
    );
  });
});
