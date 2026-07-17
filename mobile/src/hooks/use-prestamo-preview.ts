import { useEffect, useRef, useState } from 'react';
import { useCalcularTabla } from '@/hooks/use-prestamos';
import { formatCurrency } from '@/utils/formatters';
import type { FrecuenciaPago, TablaAmortizacion } from '@/types/prestamo.types';

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
