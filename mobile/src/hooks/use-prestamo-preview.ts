import { useEffect, useMemo, useRef, useState } from 'react';
import { useCalcularTabla } from '@/hooks/use-prestamos';
import { getNetworkStatus } from '@/hooks/use-network-status';
import { formatCurrency } from '@/utils/formatters';
import {
  calcularAmortizacionLocal,
  calcularAmortizacionRapidaLocal,
  siguienteFecha,
} from '@/utils/amortizacion';
import type { FrecuenciaPago, TablaAmortizacion } from '@/types/prestamo.types';

// Re-export para compatibilidad con consumidores existentes (tests incluidos).
export { siguienteFecha, calcularAmortizacionRapidaLocal };

// 2.8: replica de prestamos.service.ts:91-107 (siguienteFecha) — movida a
// @/utils/amortizacion junto con la calculadora clásica offline.

// Modo rápido (cuotas planas desde montoTotal) también vive ahora en
// @/utils/amortizacion; re-exportado arriba para no romper imports.

// Modo clásico: cálculo local con tasa de interés (para offline) — movido a
// @/utils/amortizacion con paridad exacta al backend (redondeos incluidos).

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
  const [apiPreview, setApiPreview] = useState<TablaAmortizacion | null>(null);
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [isCalculando, setIsCalculando] = useState(false);
  const solverRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 2.8: modo rápido = cálculo 100% local, idéntico al backend (sin API)
  const rapidoPreview = useMemo<TablaAmortizacion | null>(() => {
    if (!modoRapido) return null;
    const montoVal = parseFloat(monto);
    const duracionVal = parseInt(duracion, 10);
    if (!(montoVal > 0 && duracionVal > 0)) return null;

    if (modoCalculo === 'PAGO') {
      const pagoVal = parseFloat(pagoPorPeriodo);
      if (!(pagoVal > 0)) return null;
      const totalCobrar = pagoVal * duracionVal;
      return calcularAmortizacionRapidaLocal(montoVal, duracionVal, totalCobrar, frecuenciaPago, fechaInicio);
    } else {
      const gananciaVal = parseFloat(gananciaDeseada);
      if (!(gananciaVal >= 0)) return null;
      const totalCobrar = montoVal + gananciaVal;
      if (!(totalCobrar > montoVal)) return null;
      return calcularAmortizacionRapidaLocal(montoVal, duracionVal, totalCobrar, frecuenciaPago, fechaInicio);
    }
  }, [modoRapido, modoCalculo, monto, duracion, pagoPorPeriodo, gananciaDeseada, frecuenciaPago, fechaInicio]);

  // Modo clásico: preview via API (online) o local (offline)
  useEffect(() => {
    if (modoRapido) return;
    const montoVal = parseFloat(monto);
    const tasaVal = parseFloat(tasaInteres);
    const cuotasVal = parseInt(numeroCuotas);
    if (!(montoVal > 0 && tasaVal > 0 && cuotasVal > 0)) {
      setApiPreview(null);
      return;
    }
    setIsCalculando(true);

    const network = getNetworkStatus();
    if (!network.isOnline) {
      setApiPreview(calcularAmortizacionLocal(montoVal, tasaVal, cuotasVal, frecuenciaPago, fechaInicio));
      setIsCalculando(false);
    } else {
      calcularMutation({
        monto: montoVal,
        tasaInteres: tasaVal,
        numeroCuotas: cuotasVal,
        frecuenciaPago,
        fechaInicio,
      })
        .then(setApiPreview)
        .catch(() => setApiPreview(null))
        .finally(() => setIsCalculando(false));
    }
  }, [modoRapido, monto, tasaInteres, numeroCuotas, frecuenciaPago, fechaInicio, calcularMutation]);

  const preview = modoRapido ? rapidoPreview : apiPreview;

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
    let totalCobrar: number;
    if (modoCalculo === 'GANANCIA') {
      const gananciaVal = parseFloat(gananciaDeseada);
      if (montoVal > 0 && gananciaVal >= 0 && duracionVal > 0) {
        totalCobrar = montoVal + gananciaVal;
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
      totalCobrar = pagoVal * duracionVal;
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

        // 2.8: warning si la última cuota difiere significativamente de la cuota fija
        if (totalCobrar > montoVal && duracionVal > 1) {
          const cuotaFija = Math.round(totalCobrar / duracionVal);
          const ultimaCuota = totalCobrar - cuotaFija * (duracionVal - 1);
          if (cuotaFija > 0) {
            const diff = Math.abs(ultimaCuota - cuotaFija) / cuotaFija;
            if (diff > 0.2) {
              setWarnings((p) => ({
                ...p,
                cuotaDesbalanceada:
                  'La última cuota difiere significativamente de las demás. Considera ajustar el total.',
              }));
              return;
            }
          }
        }
        setWarnings((p) => {
          const n = { ...p };
          delete n.cuotaDesbalanceada;
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
