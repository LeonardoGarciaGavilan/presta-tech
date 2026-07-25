import { useEffect, useRef, useState } from 'react';
import { useCalcularTabla } from '@/hooks/use-prestamos';
import { getNetworkStatus } from '@/hooks/use-network-status';
import { formatCurrency } from '@/utils/formatters';
import type { CuotaPreview, FrecuenciaPago, TablaAmortizacion } from '@/types/prestamo.types';

const DIAS_FRECUENCIA: Record<FrecuenciaPago, number> = {
  DIARIO: 1,
  SEMANAL: 7,
  QUINCENAL: 15,
  MENSUAL: 30,
};

function calcularAmortizacionLocal(
  monto: number,
  tasaInteres: number,
  numeroCuotas: number,
  frecuenciaPago: FrecuenciaPago,
  fechaInicio?: string,
): TablaAmortizacion {
  const tasaMensual = tasaInteres / 100;
  const diasPeriodo = DIAS_FRECUENCIA[frecuenciaPago];
  const tasaPeriodo = tasaMensual * (diasPeriodo / 30);

  let cuotaFija: number;
  if (tasaPeriodo === 0) {
    cuotaFija = monto / numeroCuotas;
  } else {
    const factor = Math.pow(1 + tasaPeriodo, numeroCuotas);
    cuotaFija = (monto * tasaPeriodo * factor) / (factor - 1);
  }

  const startDate = fechaInicio ? new Date(fechaInicio) : new Date();
  const cuotas: CuotaPreview[] = [];
  let saldo = monto;
  let totalIntereses = 0;

  for (let i = 1; i <= numeroCuotas; i++) {
    const interes = Math.round(saldo * tasaPeriodo * 100) / 100;
    const capital = i === numeroCuotas ? saldo : Math.round((cuotaFija - interes) * 100) / 100;
    const montoCuota = Math.round((capital + interes) * 100) / 100;
    saldo = Math.round((saldo - capital) * 100) / 100;

    const fecha = new Date(startDate);
    fecha.setDate(fecha.getDate() + diasPeriodo * i);

    cuotas.push({
      numero: i,
      monto: montoCuota,
      capital,
      interes,
      fechaVencimiento: fecha.toISOString().split('T')[0],
      saldoRestante: Math.max(0, saldo),
    });

    totalIntereses += interes;
  }

  return {
    montoTotal: Math.round((monto + totalIntereses) * 100) / 100,
    totalIntereses: Math.round(totalIntereses * 100) / 100,
    cuotaInicial: cuotas[0]?.monto ?? 0,
    tasaPeriodo,
    cuotas,
  };
}

interface UsePrestamoPreviewParams {
  modoRapido: boolean;
  modoCalculo: 'PAGO' | 'GANANCIA';
  monto: string;
  tasaInteres: string;
  numeroCuotas: string;
  frecuenciaPago: FrecuenciaPago;
  fechaInicio: string;
  pagoPorPeriodo: string;
  gananciaDeseada: string;
  duracion: string;
}

interface UsePrestamoPreviewReturn {
  preview: TablaAmortizacion | null;
  warnings: Record<string, string>;
  isCalculando: boolean;
}

export function usePrestamoPreview({
  modoRapido,
  modoCalculo,
  monto,
  tasaInteres,
  numeroCuotas,
  frecuenciaPago,
  fechaInicio,
  pagoPorPeriodo,
  gananciaDeseada,
  duracion,
}: UsePrestamoPreviewParams): UsePrestamoPreviewReturn {
  const { mutateAsync: calcularMutation } = useCalcularTabla();
  const [preview, setPreview] = useState<TablaAmortizacion | null>(null);
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [isCalculando, setIsCalculando] = useState(false);
  const solverRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preview calculation
  useEffect(() => {
    if (modoRapido) {
      const montoVal = parseFloat(monto);
      const duracionVal = parseInt(duracion, 10);
      if (montoVal > 0 && duracionVal > 0) {
        if (modoCalculo === 'PAGO') {
          const pagoVal = parseFloat(pagoPorPeriodo);
          if (pagoVal > 0) {
            const totalCobrar = pagoVal * duracionVal;
            setIsCalculando(true);

            const network = getNetworkStatus();
            if (!network.isOnline) {
              const res = calcularAmortizacionLocal(montoVal, 0, duracionVal, frecuenciaPago, fechaInicio);
              setPreview({
                ...res,
                montoTotal: totalCobrar,
                totalIntereses: totalCobrar - montoVal,
                cuotaInicial: Math.round(pagoVal),
              });
              setIsCalculando(false);
            } else {
              calcularMutation({
                monto: montoVal,
                tasaInteres: 0,
                numeroCuotas: duracionVal,
                frecuenciaPago,
                fechaInicio,
              })
                .then((res) => {
                  setPreview({
                    ...res,
                    montoTotal: totalCobrar,
                    totalIntereses: totalCobrar - montoVal,
                    cuotaInicial: Math.round(pagoVal),
                  });
                })
                .catch(() => setPreview(null))
                .finally(() => setIsCalculando(false));
            }
          } else {
            setPreview(null);
          }
        } else {
          const gananciaVal = parseFloat(gananciaDeseada);
          if (gananciaVal >= 0) {
            const totalCobrar = montoVal + gananciaVal;
            if (totalCobrar > montoVal) {
              const cuotaIdeal = totalCobrar / duracionVal;
              setIsCalculando(true);

              const network = getNetworkStatus();
              if (!network.isOnline) {
                const res = calcularAmortizacionLocal(montoVal, 0, duracionVal, frecuenciaPago, fechaInicio);
                setPreview({
                  ...res,
                  montoTotal: totalCobrar,
                  totalIntereses: gananciaVal,
                  cuotaInicial: Math.round(cuotaIdeal),
                });
                setIsCalculando(false);
              } else {
                calcularMutation({
                  monto: montoVal,
                  tasaInteres: 0,
                  numeroCuotas: duracionVal,
                  frecuenciaPago,
                  fechaInicio,
                })
                  .then((res) => {
                    setPreview({
                      ...res,
                      montoTotal: totalCobrar,
                      totalIntereses: gananciaVal,
                      cuotaInicial: Math.round(cuotaIdeal),
                    });
                  })
                  .catch(() => setPreview(null))
                  .finally(() => setIsCalculando(false));
              }
            } else {
              setPreview(null);
            }
          } else {
            setPreview(null);
          }
        }
      } else {
        setPreview(null);
      }
    } else {
      const montoVal = parseFloat(monto);
      const tasaVal = parseFloat(tasaInteres);
      const cuotasVal = parseInt(numeroCuotas);
      if (montoVal > 0 && tasaVal > 0 && cuotasVal > 0) {
        setIsCalculando(true);

        const network = getNetworkStatus();
        if (!network.isOnline) {
          setPreview(calcularAmortizacionLocal(montoVal, tasaVal, cuotasVal, frecuenciaPago, fechaInicio));
          setIsCalculando(false);
        } else {
          calcularMutation({
            monto: montoVal,
            tasaInteres: tasaVal,
            numeroCuotas: cuotasVal,
            frecuenciaPago,
            fechaInicio,
          })
            .then(setPreview)
            .catch(() => setPreview(null))
            .finally(() => setIsCalculando(false));
        }
      } else {
        setPreview(null);
      }
    }
  }, [
    modoRapido,
    modoCalculo,
    monto,
    tasaInteres,
    numeroCuotas,
    frecuenciaPago,
    fechaInicio,
    pagoPorPeriodo,
    gananciaDeseada,
    duracion,
    calcularMutation,
  ]);

  // Auto-derive tasa & warnings in modo rapido
  useEffect(() => {
    if (!modoRapido) {
      setWarnings({});
      return;
    }
    if (solverRef.current) clearTimeout(solverRef.current);

    const montoVal = parseFloat(monto);
    const duracionVal = parseInt(duracion, 10);

    let pagoVal: number;
    if (modoCalculo === 'GANANCIA') {
      const gananciaVal = parseFloat(gananciaDeseada);
      if (montoVal > 0 && gananciaVal >= 0 && duracionVal > 0) {
        const totalCobrar = montoVal + gananciaVal;
        if (totalCobrar <= montoVal) {
          setWarnings((p) => ({
            ...p,
            gananciaInvalida: 'El total a cobrar debe ser mayor al monto prestado.',
          }));
          return;
        }
        setWarnings((p) => {
          const n = { ...p };
          delete n.gananciaInvalida;
          return n;
        });
        pagoVal = totalCobrar / duracionVal;
      } else {
        return;
      }
    } else {
      pagoVal = parseFloat(pagoPorPeriodo);
    }

    if (montoVal > 0 && pagoVal > 0 && duracionVal > 0) {
      solverRef.current = setTimeout(() => {
        const pagoMinimo = montoVal / duracionVal;
        if (pagoVal < pagoMinimo) {
          setWarnings((p) => ({
            ...p,
            pagoBajo: `El pago mínimo es ${formatCurrency(pagoMinimo)} por período`,
          }));
          return;
        }
        setWarnings((p) => {
          const n = { ...p };
          delete n.pagoBajo;
          return n;
        });
      }, 300);
    }

    return () => {
      if (solverRef.current) clearTimeout(solverRef.current);
    };
  }, [modoRapido, modoCalculo, monto, pagoPorPeriodo, gananciaDeseada, duracion]);

  return { preview, warnings, isCalculando };
}
